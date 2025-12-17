from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from enum import Enum

db = SQLAlchemy()

class UserRole(Enum):
    OWNER = 'owner'
    MANAGER = 'manager'
    STAFF = 'staff'

class Brand(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    is_active = db.Column(db.Boolean, default=True)
    models = db.relationship('Model', backref='brand', lazy=True)

class Model(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    brand_id = db.Column(db.Integer, db.ForeignKey('brand.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    order_index = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    storages = db.relationship('StorageOption', backref='model', lazy=True)

class StorageOption(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    model_id = db.Column(db.Integer, db.ForeignKey('model.id'), nullable=False)
    size = db.Column(db.String(20), nullable=False)
    is_active = db.Column(db.Boolean, default=True)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))
    price = db.Column(db.Float, default=0)
    cost = db.Column(db.Float, default=0)
    stock_quantity = db.Column(db.Integer, default=0)
    images = db.Column(db.String(500))
    is_preloaded = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)

class Device(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    brand = db.Column(db.String(50), nullable=False)
    model = db.Column(db.String(50), nullable=False)
    storage = db.Column(db.String(50))
    color = db.Column(db.String(30))
    imei_or_serial = db.Column(db.String(100), unique=True)
    status = db.Column(db.String(50), default='available')
    photos = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(50))

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(50))

class Lead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lead_number = db.Column(db.String(20), unique=True)
    customer_name = db.Column(db.String(100), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    customer_email = db.Column(db.String(100))
    interest = db.Column(db.String(200))
    source = db.Column(db.String(50))
    status = db.Column(db.String(30), default='new')
    notes = db.Column(db.Text)
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    updated_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    closed_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    closed_at = db.Column(db.DateTime)
    follow_up_date = db.Column(db.DateTime)
    last_contact = db.Column(db.DateTime)

class Sale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sale_number = db.Column(db.String(20), unique=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=True)
    device_id = db.Column(db.Integer, db.ForeignKey('device.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=True)
    lead_id = db.Column(db.Integer, db.ForeignKey('lead.id'), nullable=True)
    other_product_name = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=1)
    unit_price = db.Column(db.Float, default=0)
    cost_price = db.Column(db.Float, default=0)
    total_price = db.Column(db.Float, default=0)
    profit = db.Column(db.Float, default=0)
    payment_method = db.Column(db.String(20))
    payment_status = db.Column(db.String(20), default='completed')
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    updated_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

class TradeIn(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    trade_in_number = db.Column(db.String(20), unique=True)
    brand = db.Column(db.String(50), nullable=False)
    model = db.Column(db.String(50), nullable=False)
    storage = db.Column(db.String(50))
    color = db.Column(db.String(30))
    imei = db.Column(db.String(20))
    serial_number = db.Column(db.String(50))
    customer_name = db.Column(db.String(100), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    customer_email = db.Column(db.String(100))
    base_value = db.Column(db.Float, default=0)
    condition_score = db.Column(db.Integer, default=100)
    calculated_offer = db.Column(db.Float, default=0)
    final_offer = db.Column(db.Float)
    status = db.Column(db.String(20), default='pending')
    payout_method = db.Column(db.String(20))
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    updated_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    reviewed_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime)

class Repair(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    repair_number = db.Column(db.String(20), unique=True)
    device_brand = db.Column(db.String(50), nullable=False)
    device_model = db.Column(db.String(50), nullable=False)
    device_serial = db.Column(db.String(100))
    customer_name = db.Column(db.String(100), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    issue_description = db.Column(db.Text)
    diagnosis = db.Column(db.Text)
    repair_cost = db.Column(db.Float, default=0)
    parts_cost = db.Column(db.Float, default=0)
    total_cost = db.Column(db.Float, default=0)
    status = db.Column(db.String(30), default='received')
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    updated_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    completed_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

class Delivery(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    delivery_number = db.Column(db.String(20), unique=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('sale.id'))
    customer_name = db.Column(db.String(100), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    address = db.Column(db.Text)
    delivery_date = db.Column(db.DateTime)
    status = db.Column(db.String(30), default='pending')
    notes = db.Column(db.Text)
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    updated_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    completed_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    pin = db.Column(db.String(10))
    name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    role = db.Column(db.String(20), default='staff')
    is_active = db.Column(db.Boolean, default=True)
    last_activity = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    
    def can_view_all_leads(self):
        return self.role in ['owner', 'manager']
    
    def can_assign_leads(self):
        return self.role in ['owner', 'manager']
    
    def can_delete_records(self):
        return self.role == 'owner'
    
    def can_view_profits(self):
        return self.role == 'owner'
    
    def can_view_staff_metrics(self):
        return self.role in ['owner', 'manager']
    
    def can_manage_staff(self):
        return self.role == 'owner'
    
    def can_view_all_deliveries(self):
        return self.role in ['owner', 'manager']
    
    def can_access_settings(self):
        return self.role == 'owner'

class ActivityLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    user_name = db.Column(db.String(100))
    action = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(50))
    entity_id = db.Column(db.Integer)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user = db.Column(db.String(50))
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
