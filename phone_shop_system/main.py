from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from models import db, Brand, Model, StorageOption, Product, Device, Customer, Sale, TradeIn, Repair, User, AuditLog
from datetime import datetime
from functools import wraps
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///phone_shop.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
db.init_app(app)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

@app.before_request
def create_tables():
    if not hasattr(app, '_db_initialized'):
        db.create_all()
        seed_data()
        app._db_initialized = True

def seed_data():
    if Brand.query.count() == 0:
        apple = Brand(name="Apple")
        samsung = Brand(name="Samsung")
        google = Brand(name="Google")
        db.session.add_all([apple, samsung, google])
        db.session.commit()
        
        iphone_models = [
            "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
            "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
            "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
            "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 Mini",
            "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 Mini",
            "iPhone SE (3rd Gen)", "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11"
        ]
        for i, name in enumerate(iphone_models):
            db.session.add(Model(name=name, brand_id=apple.id, order_index=i))
        
        samsung_models = [
            "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24",
            "Galaxy S23 Ultra", "Galaxy S23+", "Galaxy S23",
            "Galaxy Z Fold5", "Galaxy Z Flip5", "Galaxy A54"
        ]
        for i, name in enumerate(samsung_models):
            db.session.add(Model(name=name, brand_id=samsung.id, order_index=i))
        
        google_models = ["Pixel 8 Pro", "Pixel 8", "Pixel 7 Pro", "Pixel 7", "Pixel 7a"]
        for i, name in enumerate(google_models):
            db.session.add(Model(name=name, brand_id=google.id, order_index=i))
        
        db.session.commit()
        
        for model in Model.query.all():
            if "Pro" in model.name or "Ultra" in model.name:
                sizes = ["256GB", "512GB", "1TB"]
            elif "Mini" in model.name or "SE" in model.name:
                sizes = ["64GB", "128GB", "256GB"]
            else:
                sizes = ["128GB", "256GB", "512GB"]
            for size in sizes:
                db.session.add(StorageOption(model_id=model.id, size=size))
        
        db.session.commit()
        
        admin = User(username="admin", password_hash="admin123", name="Administrator", role="admin")
        staff = User(username="staff", password_hash="staff123", name="Staff Member", role="staff")
        db.session.add_all([admin, staff])
        db.session.commit()

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username, is_active=True).first()
        if user and user.password_hash == password:
            session['user_id'] = user.id
            session['username'] = user.username
            session['name'] = user.name
            session['role'] = user.role
            db.session.add(AuditLog(user=username, action='login', details='User logged in'))
            db.session.commit()
            return redirect(url_for('dashboard'))
        return render_template('login.html', error='Invalid credentials')
    return render_template('login.html')

@app.route('/logout')
def logout():
    if 'username' in session:
        db.session.add(AuditLog(user=session['username'], action='logout', details='User logged out'))
        db.session.commit()
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    sales = Sale.query.order_by(Sale.created_at.desc()).limit(10).all()
    tradeins = TradeIn.query.filter_by(status='pending').all()
    repairs = Repair.query.filter(Repair.status != 'completed').all()
    return render_template('dashboard.html', sales=sales, tradeins=tradeins, repairs=repairs)

@app.route('/tradein')
@login_required
def tradein():
    brands = Brand.query.filter_by(is_active=True).all()
    return render_template('tradein_wizard.html', brands=brands)

@app.route('/sales')
@login_required
def sales_form():
    products = Product.query.filter_by(is_active=True).all()
    return render_template('sales_form.html', products=products)

@app.route('/repairs')
@login_required
def repairs_form():
    brands = Brand.query.filter_by(is_active=True).all()
    return render_template('repair_form.html', brands=brands)

@app.route('/admin/models')
@admin_required
def admin_models():
    brands = Brand.query.all()
    models = Model.query.order_by(Model.order_index.desc()).all()
    return render_template('admin_models.html', brands=brands, models=models)

@app.route('/admin/staff')
@admin_required
def admin_staff():
    users = User.query.all()
    return render_template('admin_staff.html', users=users)

@app.route('/api/brands')
def get_brands():
    brands = Brand.query.filter_by(is_active=True).all()
    return jsonify([{"id": b.id, "name": b.name} for b in brands])

@app.route('/api/models')
def get_models():
    brand_id = request.args.get('brand_id') or request.args.get('brand')
    if not brand_id:
        return jsonify([])
    models = Model.query.filter_by(brand_id=brand_id, is_active=True).order_by(Model.order_index.desc()).all()
    return jsonify([{"id": m.id, "name": m.name} for m in models])

@app.route('/api/storages')
def get_storages():
    model_id = request.args.get('model_id')
    if not model_id:
        return jsonify([])
    storages = StorageOption.query.filter_by(model_id=model_id, is_active=True).all()
    return jsonify([{"id": s.id, "size": s.size} for s in storages])

@app.route('/api/validate-serial')
def validate_serial():
    serial = request.args.get('serial')
    if not serial:
        return jsonify({"valid": False, "error": "Serial required"})
    exists = Device.query.filter_by(imei_or_serial=serial).first()
    tradein_exists = TradeIn.query.filter_by(imei=serial).first()
    return jsonify({
        "valid": True,
        "is_duplicate": exists is not None or tradein_exists is not None,
        "warning": "Device already in system" if exists or tradein_exists else None
    })

@app.route('/api/tradein', methods=['POST'])
@login_required
def submit_tradein():
    data = request.json or request.form
    count = TradeIn.query.count()
    trade_in_number = f"TI-{str(10001 + count).zfill(5)}"
    
    tradein = TradeIn(
        trade_in_number=trade_in_number,
        brand=data.get('brand'),
        model=data.get('model'),
        storage=data.get('storage'),
        color=data.get('color'),
        imei=data.get('imei'),
        serial_number=data.get('serial_number'),
        customer_name=data.get('customer_name'),
        customer_phone=data.get('customer_phone'),
        customer_email=data.get('customer_email'),
        base_value=float(data.get('base_value', 0)),
        condition_score=int(data.get('condition_score', 100)),
        calculated_offer=float(data.get('calculated_offer', 0)),
        status='pending',
        created_by=session.get('username')
    )
    db.session.add(tradein)
    db.session.add(AuditLog(user=session.get('username'), action='tradein_created', details=f'Trade-in {trade_in_number} created'))
    db.session.commit()
    
    return jsonify({"success": True, "trade_in_number": trade_in_number, "id": tradein.id})

@app.route('/api/sale', methods=['POST'])
@login_required
def submit_sale():
    data = request.json or request.form
    quantity = int(data.get('quantity', 1))
    unit_price = float(data.get('unit_price', 0))
    
    sale = Sale(
        product_id=data.get('product_id') if data.get('product_id') else None,
        other_product_name=data.get('other_product_name'),
        quantity=quantity,
        unit_price=unit_price,
        total_price=quantity * unit_price,
        payment_method=data.get('payment_method'),
        created_by=session.get('username'),
        created_at=datetime.now()
    )
    db.session.add(sale)
    db.session.add(AuditLog(user=session.get('username'), action='sale_created', details=f'Sale created: ${sale.total_price}'))
    db.session.commit()
    
    return jsonify({"success": True, "sale_id": sale.id})

@app.route('/api/repair', methods=['POST'])
@login_required
def submit_repair():
    data = request.json or request.form
    count = Repair.query.count()
    repair_number = f"RP-{str(10001 + count).zfill(5)}"
    
    repair = Repair(
        repair_number=repair_number,
        device_brand=data.get('brand'),
        device_model=data.get('model'),
        device_serial=data.get('serial'),
        customer_name=data.get('customer_name'),
        customer_phone=data.get('customer_phone'),
        issue_description=data.get('issue_description'),
        status='received',
        created_by=session.get('username')
    )
    db.session.add(repair)
    db.session.add(AuditLog(user=session.get('username'), action='repair_created', details=f'Repair {repair_number} created'))
    db.session.commit()
    
    return jsonify({"success": True, "repair_number": repair_number, "id": repair.id})

@app.route('/receipt/<int:sale_id>')
@login_required
def receipt(sale_id):
    sale = Sale.query.get_or_404(sale_id)
    return render_template('receipt.html', sale=sale)

@app.route('/api/dashboard-stats')
@login_required
def dashboard_stats():
    today = datetime.now().date()
    sales_today = Sale.query.filter(db.func.date(Sale.created_at) == today).all()
    total_sales = sum(s.total_price for s in sales_today)
    pending_tradeins = TradeIn.query.filter_by(status='pending').count()
    active_repairs = Repair.query.filter(Repair.status != 'completed').count()
    
    return jsonify({
        "sales_today": total_sales,
        "sales_count": len(sales_today),
        "pending_tradeins": pending_tradeins,
        "active_repairs": active_repairs
    })

@app.route('/api/audit-logs')
@admin_required
def get_audit_logs():
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(100).all()
    return jsonify([{
        "user": l.user,
        "action": l.action,
        "details": l.details,
        "timestamp": l.timestamp.isoformat()
    } for l in logs])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
