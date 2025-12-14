from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

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

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Sale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=True)
    device_id = db.Column(db.Integer, db.ForeignKey('device.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=True)
    other_product_name = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=1)
    unit_price = db.Column(db.Float, default=0)
    total_price = db.Column(db.Float, default=0)
    payment_method = db.Column(db.String(20))
    created_by = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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
    created_by = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_by = db.Column(db.String(50))
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
    assigned_to = db.Column(db.String(50))
    created_by = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    name = db.Column(db.String(100))
    role = db.Column(db.String(20), default='staff')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user = db.Column(db.String(50))
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
