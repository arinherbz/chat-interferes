from flask import Flask, render_template, request, jsonify, redirect, url_for, session, g
from models import db, Brand, Model, StorageOption, Product, Device, Customer, Sale, TradeIn, Repair, User, ActivityLog, AuditLog, Lead, Delivery
from datetime import datetime, timedelta
from functools import wraps
import os
import hashlib

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///phone_shop.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'ariotech-secret-key-2024')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
db.init_app(app)

@app.context_processor
def inject_globals():
    return {
        'now': datetime.now,
        'current_user': g.get('current_user')
    }

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def log_activity(action, entity_type=None, entity_id=None, details=None):
    if 'user_id' in session:
        activity = ActivityLog(
            user_id=session.get('user_id'),
            user_name=session.get('name'),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=request.remote_addr
        )
        db.session.add(activity)
        db.session.commit()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json:
                return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('login'))
        user = User.query.get(session['user_id'])
        if not user or not user.is_active:
            session.clear()
            return redirect(url_for('login'))
        user.last_activity = datetime.utcnow()
        db.session.commit()
        g.current_user = user
        return f(*args, **kwargs)
    return decorated_function

def owner_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        if session.get('role') != 'owner':
            if request.is_json:
                return jsonify({'error': 'Owner access required'}), 403
            return render_template('error.html', message='Access denied. Owner privileges required.'), 403
        return f(*args, **kwargs)
    return decorated_function

def manager_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        if session.get('role') not in ['owner', 'manager']:
            if request.is_json:
                return jsonify({'error': 'Manager access required'}), 403
            return render_template('error.html', message='Access denied. Manager privileges required.'), 403
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
            db.session.add(Model(name=name, brand_id=apple.id, order_index=len(iphone_models)-i))
        
        samsung_models = [
            "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24",
            "Galaxy S23 Ultra", "Galaxy S23+", "Galaxy S23",
            "Galaxy Z Fold5", "Galaxy Z Flip5", "Galaxy A54"
        ]
        for i, name in enumerate(samsung_models):
            db.session.add(Model(name=name, brand_id=samsung.id, order_index=len(samsung_models)-i))
        
        google_models = ["Pixel 8 Pro", "Pixel 8", "Pixel 7 Pro", "Pixel 7", "Pixel 7a"]
        for i, name in enumerate(google_models):
            db.session.add(Model(name=name, brand_id=google.id, order_index=len(google_models)-i))
        
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
    
    if User.query.count() == 0:
        owner = User(
            username="owner",
            password_hash=hash_password("owner123"),
            pin="1234",
            name="Shop Owner",
            role="owner"
        )
        manager = User(
            username="manager",
            password_hash=hash_password("manager123"),
            pin="5678",
            name="Store Manager",
            role="manager"
        )
        staff = User(
            username="staff",
            password_hash=hash_password("staff123"),
            pin="0000",
            name="Sales Staff",
            role="staff"
        )
        db.session.add_all([owner, manager, staff])
        db.session.commit()

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip().lower()
        password = request.form.get('password', '').strip()
        pin = request.form.get('pin', '').strip()
        
        user = User.query.filter_by(username=username, is_active=True).first()
        
        if user:
            auth_valid = False
            if password and user.password_hash == hash_password(password):
                auth_valid = True
            elif pin and user.pin == pin:
                auth_valid = True
            
            if auth_valid:
                session.permanent = True
                session['user_id'] = user.id
                session['username'] = user.username
                session['name'] = user.name
                session['role'] = user.role
                user.last_activity = datetime.utcnow()
                db.session.commit()
                log_activity('login', details='User logged in successfully')
                return redirect(url_for('dashboard'))
        
        return render_template('login.html', error='Invalid credentials. Please try again.')
    return render_template('login.html')

@app.route('/logout')
def logout():
    if 'user_id' in session:
        log_activity('logout', details='User logged out')
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    user = g.current_user
    today = datetime.now().date()
    
    if user.role == 'owner':
        sales = Sale.query.order_by(Sale.created_at.desc()).limit(10).all()
        tradeins = TradeIn.query.filter_by(status='pending').all()
        repairs = Repair.query.filter(Repair.status != 'completed').all()
        leads = Lead.query.filter(Lead.status.in_(['new', 'contacted', 'follow_up'])).all()
        deliveries = Delivery.query.filter(Delivery.status != 'completed').all()
        
        sales_today = Sale.query.filter(db.func.date(Sale.created_at) == today).all()
        total_revenue = sum(s.total_price for s in sales_today)
        total_profit = sum(s.profit for s in sales_today if s.profit)
        
        staff_sales = db.session.query(
            User.name,
            db.func.count(Sale.id).label('count'),
            db.func.sum(Sale.total_price).label('total')
        ).join(Sale, Sale.created_by == User.id).filter(
            db.func.date(Sale.created_at) == today
        ).group_by(User.id).all()
        
    elif user.role == 'manager':
        sales = Sale.query.order_by(Sale.created_at.desc()).limit(10).all()
        tradeins = TradeIn.query.filter_by(status='pending').all()
        repairs = Repair.query.filter(Repair.status != 'completed').all()
        leads = Lead.query.filter(Lead.status.in_(['new', 'contacted', 'follow_up'])).all()
        deliveries = Delivery.query.filter(Delivery.status != 'completed').all()
        
        sales_today = Sale.query.filter(db.func.date(Sale.created_at) == today).all()
        total_revenue = sum(s.total_price for s in sales_today)
        total_profit = None
        staff_sales = []
        
    else:
        sales = Sale.query.filter_by(created_by=user.id).order_by(Sale.created_at.desc()).limit(10).all()
        tradeins = TradeIn.query.filter_by(created_by=user.id, status='pending').all()
        repairs = Repair.query.filter_by(created_by=user.id).filter(Repair.status != 'completed').all()
        leads = Lead.query.filter_by(created_by=user.id).filter(Lead.status.in_(['new', 'contacted', 'follow_up'])).all()
        deliveries = []
        
        sales_today = Sale.query.filter(
            Sale.created_by == user.id,
            db.func.date(Sale.created_at) == today
        ).all()
        total_revenue = sum(s.total_price for s in sales_today)
        total_profit = None
        staff_sales = []
    
    return render_template('dashboard.html',
        sales=sales,
        tradeins=tradeins,
        repairs=repairs,
        leads=leads,
        deliveries=deliveries,
        total_revenue=total_revenue,
        total_profit=total_profit,
        staff_sales=staff_sales,
        sales_count=len(sales_today)
    )

@app.route('/leads')
@login_required
def leads_list():
    user = g.current_user
    if user.can_view_all_leads():
        leads = Lead.query.order_by(Lead.created_at.desc()).all()
    else:
        leads = Lead.query.filter_by(created_by=user.id).order_by(Lead.created_at.desc()).all()
    return render_template('leads.html', leads=leads)

@app.route('/leads/add', methods=['GET', 'POST'])
@login_required
def add_lead():
    if request.method == 'POST':
        data = request.form
        count = Lead.query.count()
        lead = Lead(
            lead_number=f"LD-{str(10001 + count).zfill(5)}",
            customer_name=data.get('customer_name'),
            customer_phone=data.get('customer_phone'),
            customer_email=data.get('customer_email'),
            interest=data.get('interest'),
            source=data.get('source'),
            notes=data.get('notes'),
            created_by=session.get('user_id'),
            assigned_to=session.get('user_id')
        )
        db.session.add(lead)
        db.session.commit()
        log_activity('lead_created', 'lead', lead.id, f'Lead {lead.lead_number} created')
        return redirect(url_for('leads_list'))
    return render_template('add_lead.html')

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

@app.route('/staff')
@owner_required
def staff_management():
    users = User.query.order_by(User.role, User.name).all()
    return render_template('staff_management.html', users=users)

@app.route('/staff/add', methods=['GET', 'POST'])
@owner_required
def add_staff():
    if request.method == 'POST':
        data = request.form
        existing = User.query.filter_by(username=data.get('username').lower()).first()
        if existing:
            return render_template('add_staff.html', error='Username already exists')
        
        user = User(
            username=data.get('username').lower(),
            password_hash=hash_password(data.get('password')),
            pin=data.get('pin'),
            name=data.get('name'),
            phone=data.get('phone'),
            role=data.get('role', 'staff'),
            created_by=session.get('user_id')
        )
        db.session.add(user)
        db.session.commit()
        log_activity('staff_created', 'user', user.id, f'Staff {user.name} created with role {user.role}')
        return redirect(url_for('staff_management'))
    return render_template('add_staff.html')

@app.route('/staff/<int:user_id>/toggle', methods=['POST'])
@owner_required
def toggle_staff(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == session.get('user_id'):
        return jsonify({'error': 'Cannot deactivate yourself'}), 400
    user.is_active = not user.is_active
    db.session.commit()
    log_activity('staff_toggled', 'user', user.id, f'Staff {user.name} {"activated" if user.is_active else "deactivated"}')
    return jsonify({'success': True, 'is_active': user.is_active})

@app.route('/owner/dashboard')
@owner_required
def owner_dashboard():
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)
    
    staff_performance = db.session.query(
        User.id,
        User.name,
        User.role,
        db.func.count(Sale.id).label('sales_count'),
        db.func.sum(Sale.total_price).label('total_sales'),
        db.func.sum(Sale.profit).label('total_profit')
    ).outerjoin(Sale, Sale.created_by == User.id).filter(
        User.role.in_(['staff', 'manager']),
        User.is_active == True
    ).group_by(User.id).all()
    
    leads_stats = db.session.query(
        User.name,
        db.func.count(Lead.id).label('total_leads'),
        db.func.sum(db.case((Lead.status == 'converted', 1), else_=0)).label('converted')
    ).outerjoin(Lead, Lead.created_by == User.id).filter(
        User.role.in_(['staff', 'manager'])
    ).group_by(User.id).all()
    
    overdue_followups = Lead.query.filter(
        Lead.follow_up_date < datetime.now(),
        Lead.status.in_(['new', 'contacted', 'follow_up'])
    ).count()
    
    pending_deliveries = Delivery.query.filter_by(status='pending').count()
    failed_deliveries = Delivery.query.filter_by(status='failed').count()
    
    recent_activities = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).limit(50).all()
    
    return render_template('owner_dashboard.html',
        staff_performance=staff_performance,
        leads_stats=leads_stats,
        overdue_followups=overdue_followups,
        pending_deliveries=pending_deliveries,
        failed_deliveries=failed_deliveries,
        recent_activities=recent_activities
    )

@app.route('/admin/models')
@owner_required
def admin_models():
    brands = Brand.query.all()
    models = Model.query.order_by(Model.order_index.desc()).all()
    return render_template('admin_models.html', brands=brands, models=models)

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
        created_by=session.get('user_id')
    )
    db.session.add(tradein)
    db.session.commit()
    log_activity('tradein_created', 'tradein', tradein.id, f'Trade-in {trade_in_number} created')
    
    return jsonify({"success": True, "trade_in_number": trade_in_number, "id": tradein.id})

@app.route('/api/sale', methods=['POST'])
@login_required
def submit_sale():
    data = request.json or request.form
    count = Sale.query.count()
    quantity = int(data.get('quantity', 1))
    unit_price = float(data.get('unit_price', 0))
    cost_price = float(data.get('cost_price', 0))
    total = quantity * unit_price
    profit = total - (quantity * cost_price) if cost_price else 0
    
    sale = Sale(
        sale_number=f"SL-{str(10001 + count).zfill(5)}",
        product_id=data.get('product_id') if data.get('product_id') else None,
        other_product_name=data.get('other_product_name'),
        quantity=quantity,
        unit_price=unit_price,
        cost_price=cost_price,
        total_price=total,
        profit=profit,
        payment_method=data.get('payment_method'),
        created_by=session.get('user_id'),
        created_at=datetime.now()
    )
    db.session.add(sale)
    db.session.commit()
    log_activity('sale_created', 'sale', sale.id, f'Sale {sale.sale_number} for ${total}')
    
    return jsonify({"success": True, "sale_id": sale.id, "sale_number": sale.sale_number})

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
        created_by=session.get('user_id')
    )
    db.session.add(repair)
    db.session.commit()
    log_activity('repair_created', 'repair', repair.id, f'Repair {repair_number} created')
    
    return jsonify({"success": True, "repair_number": repair_number, "id": repair.id})

@app.route('/receipt/<int:sale_id>')
@login_required
def receipt(sale_id):
    sale = Sale.query.get_or_404(sale_id)
    user = g.current_user
    if user.role == 'staff' and sale.created_by != user.id:
        return render_template('error.html', message='Access denied'), 403
    creator = User.query.get(sale.created_by) if sale.created_by else None
    return render_template('receipt.html', sale=sale, creator=creator)

@app.route('/api/dashboard-stats')
@login_required
def dashboard_stats():
    user = g.current_user
    today = datetime.now().date()
    
    if user.role == 'owner':
        sales_today = Sale.query.filter(db.func.date(Sale.created_at) == today).all()
        total_sales = sum(s.total_price for s in sales_today)
        total_profit = sum(s.profit for s in sales_today if s.profit)
        pending_tradeins = TradeIn.query.filter_by(status='pending').count()
        active_repairs = Repair.query.filter(Repair.status != 'completed').count()
    elif user.role == 'manager':
        sales_today = Sale.query.filter(db.func.date(Sale.created_at) == today).all()
        total_sales = sum(s.total_price for s in sales_today)
        total_profit = None
        pending_tradeins = TradeIn.query.filter_by(status='pending').count()
        active_repairs = Repair.query.filter(Repair.status != 'completed').count()
    else:
        sales_today = Sale.query.filter(
            Sale.created_by == user.id,
            db.func.date(Sale.created_at) == today
        ).all()
        total_sales = sum(s.total_price for s in sales_today)
        total_profit = None
        pending_tradeins = TradeIn.query.filter_by(created_by=user.id, status='pending').count()
        active_repairs = Repair.query.filter_by(created_by=user.id).filter(Repair.status != 'completed').count()
    
    response = {
        "sales_today": total_sales,
        "sales_count": len(sales_today),
        "pending_tradeins": pending_tradeins,
        "active_repairs": active_repairs
    }
    if total_profit is not None:
        response["profit_today"] = total_profit
    
    return jsonify(response)

@app.route('/api/staff-performance')
@owner_required
def staff_performance_api():
    today = datetime.now().date()
    
    performance = db.session.query(
        User.id,
        User.name,
        User.role,
        db.func.count(Sale.id).label('sales_count'),
        db.func.sum(Sale.total_price).label('total_sales'),
        db.func.sum(Sale.profit).label('total_profit')
    ).outerjoin(Sale, db.and_(
        Sale.created_by == User.id,
        db.func.date(Sale.created_at) == today
    )).filter(
        User.role.in_(['staff', 'manager']),
        User.is_active == True
    ).group_by(User.id).all()
    
    return jsonify([{
        "id": p.id,
        "name": p.name,
        "role": p.role,
        "sales_count": p.sales_count or 0,
        "total_sales": float(p.total_sales or 0),
        "total_profit": float(p.total_profit or 0)
    } for p in performance])

@app.route('/api/activity-log')
@owner_required
def activity_log_api():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    activities = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        "items": [{
            "id": a.id,
            "user_name": a.user_name,
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "details": a.details,
            "timestamp": a.timestamp.isoformat()
        } for a in activities.items],
        "total": activities.total,
        "pages": activities.pages,
        "current_page": page
    })

@app.errorhandler(404)
def not_found(e):
    return render_template('error.html', message='Page not found'), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('error.html', message='Something went wrong. Please try again.'), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
