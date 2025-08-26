import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from functools import wraps
import logging
import json # Import json for handling items_json in orders sheet

from flask import Flask, request, jsonify, session, redirect, url_for, render_template, g, abort
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

import pandas as pd # Still used for CSV import for SQLite products

# --- Google Sheets Integration Imports ---
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
app = Flask(__name__,
            template_folder='.',
            static_folder='static_assets',
            static_url_path='/static_assets')

app.secret_key = 'your_super_secret_key_here_for_sessions_and_security_khetihal'
app.config['DATABASE'] = 'instance/site.db'
app.config['UPLOAD_FOLDER'] = 'instance/uploads'
app.config['ALLOWED_EXTENSIONS'] = {'csv'}

if not os.path.exists('instance'):
    os.makedirs('instance')
    app.logger.info("Created 'instance/' directory.")
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])
    app.logger.info("Created 'instance/uploads/' directory.")

# --- Email Configuration ---
EMAIL_ADDRESS = 'khetihal21@gmail.com'
EMAIL_PASSWORD = 'uhgw fdub cika tguw'

# --- Google Sheets Setup ---
# Path to your service account key file
GOOGLE_CREDENTIALS_PATH = 'google_credentials.json'

try:
    # Use service account to authenticate
    gc = gspread.service_account(filename=GOOGLE_CREDENTIALS_PATH)
    app.logger.info("Successfully authenticated with Google Sheets API.")
    
    # Open your sheets by name
    # Ensure these names exactly match the sheet names you created in Google Sheets
    products_sheet = gc.open("Khetihal Products Data").sheet1
    orders_sheet = gc.open("Khetihal Orders Data").sheet1
    app.logger.info("Successfully opened 'Khetihal Products Data' and 'Khetihal Orders Data' sheets.")

except Exception as e:
    app.logger.error(f"Failed to authenticate or open Google Sheets: {e}")
    app.logger.error("Please ensure 'google_credentials.json' is in the root directory and APIs are enabled/sheets are shared.")
    # In a real app, you might want to gracefully degrade or halt if Sheets are critical.
    # For now, we'll let the app run but Sheets functionality will fail.
    products_sheet = None
    orders_sheet = None


# --- Database Functions (for SQLite - customer facing) ---

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    cursor = db.cursor()

    app.logger.info("Starting SQLite database initialization...")

    cursor.execute("DROP TABLE IF EXISTS users")
    cursor.execute("DROP TABLE IF EXISTS password_reset_tokens")
    cursor.execute("DROP TABLE IF EXISTS products")
    cursor.execute("DROP TABLE IF EXISTS cart_items")
    cursor.execute("DROP TABLE IF EXISTS shipping_info")
    cursor.execute("DROP TABLE IF EXISTS orders")
    cursor.execute("DROP TABLE IF EXISTS order_items")
    app.logger.info("Dropped existing SQLite tables (if any).")

    cursor.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    app.logger.info("Created 'users' table.")

    cursor.execute("""
        CREATE TABLE password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    app.logger.info("Created 'password_reset_tokens' table.")

    cursor.execute("""
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            image_url TEXT,
            stock INTEGER NOT NULL DEFAULT 0
        )
    """)
    app.logger.info("Created 'products' table.")

    cursor.execute("""
        CREATE TABLE cart_items (
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            PRIMARY KEY (user_id, product_id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (product_id) REFERENCES products (id)
        )
    """)
    app.logger.info("Created 'cart_items' table.")

    cursor.execute("""
        CREATE TABLE shipping_info (
            user_id INTEGER PRIMARY KEY,
            full_name TEXT NOT NULL,
            address_line1 TEXT NOT NULL,
            address_line2 TEXT NOT NULL,
            address_line3 TEXT,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            zip_code TEXT NOT NULL,
            phone TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    app.logger.info("Created 'shipping_info' table.")

    cursor.execute("""
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_amount REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            payment_method TEXT,
            full_name TEXT NOT NULL,
            address_line1 TEXT NOT NULL,
            address_line2 TEXT NOT NULL,
            address_line3 TEXT,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            zip_code TEXT NOT NULL,
            phone TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    app.logger.info("Created 'orders' table.")

    cursor.execute("""
        CREATE TABLE order_items (
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            product_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            PRIMARY KEY (order_id, product_id),
            FOREIGN KEY (order_id) REFERENCES orders (id),
            FOREIGN KEY (product_id) REFERENCES products (id)
        )
    """)
    app.logger.info("Created 'order_items' table.")

    admin_username = os.environ.get('ADMIN_USERNAME', 'admin')
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@khetihal.com')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'adminpassword')
    
    hashed_admin_password = generate_password_hash(admin_password)
    cursor.execute("INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)",
                   (admin_username, admin_email, hashed_admin_password, 1))
    db.commit()
    app.logger.info(f"Inserted default admin user into SQLite: Email='{admin_email}', Password='{admin_password}'.")

    products_data = [
        ('Organic Tomatoes', 'Fresh, ripe organic tomatoes from local farms.', 2.50, '/static_assets/image/product1.jpg', 100),
        ('Farm Fresh Eggs', 'Free-range eggs, rich in protein and flavor.', 3.00, '/static_assets/image/product2.jpg', 50),
        ('Whole Wheat Bread', 'Artisan whole wheat bread, baked fresh daily.', 4.20, '/static_assets/image/product3.jpg', 75),
        ('Green Bell Peppers', 'Crisp and sweet green bell peppers.', 1.80, '/static_assets/image/product4.jpg', 120),
        ('Fresh Milk (1L)', 'Locally sourced, pasteurized fresh milk.', 1.50, '/static_assets/image/product5.jpg', 80),
        ('Organic Apples', 'Sweet and crunchy organic apples.', 3.00, '/static_assets/image/product6.jpg', 90),
        ('Spinach Bunch', 'Fresh, leafy spinach, perfect for healthy meals.', 1.20, '/static_assets/image/product7.jpg', 150),
        ('Potatoes (5kg)', 'Versatile and essential for every kitchen.', 5.00, '/static_assets/image/product8.jpg', 60),
        ('Chicken Breast (1kg)', 'Boneless, skinless chicken breast.', 8.50, '/static_assets/image/product9.jpg', 40),
        ('Brown Rice (1kg)', 'Nutritious whole grain brown rice.', 2.80, '/static_assets/image/product10.jpg', 110)
    ]
    cursor.executemany("INSERT INTO products (name, description, price, image_url, stock) VALUES (?, ?, ?, ?, ?)", products_data)
    db.commit()
    app.logger.info("Inserted dummy products into SQLite.")
    app.logger.info("SQLite database initialization complete.")

@app.cli.command('init-db')
def init_db_command():
    """Clear existing data and create new tables."""
    init_db()
    print('Initialized the SQLite database.')
    app.logger.info("SQLite database initialized via 'flask init-db' command.")

@app.teardown_appcontext
def teardown_db(exception):
    close_db()


# --- Authentication and Authorization Decorators ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            app.logger.warning("Access denied: User not logged in for protected route. Redirecting to login.")
            return redirect(url_for('serve_login'))
        
        db = get_db()
        g.user = db.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],)).fetchone()
        
        if g.user is None:
            app.logger.warning(f"Access denied: User ID {session.get('user_id')} in session but not found in DB. Clearing session.")
            session.pop('user_id', None)
            return redirect(url_for('serve_login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            app.logger.warning("Admin access denied: User not logged in. Redirecting to admin login.")
            return redirect(url_for('serve_admin_login')) 
        
        db = get_db()
        g.user = db.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],)).fetchone()
        
        if g.user and g.user['is_admin'] == 1:
            app.logger.info(f"Admin access granted for user: {g.user['email']}")
            return f(*args, **kwargs)
        else:
            app.logger.warning(f"Admin access denied: User {g.user['email'] if g.user else 'N/A'} is not an admin. Aborting 403.")
            abort(403)
    return decorated_function


# --- Helper Functions ---

def send_reset_email(email, token):
    reset_link = url_for('serve_reset_password', token=token, _external=True)
    
    msg = MIMEMultipart("alternative")
    msg['Subject'] = "KhetiHal Password Reset Request"
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = email

    text = f"""
    Dear KhetiHal User,

    You have requested to reset your password.
    Please click on the following link to reset your password:
    {reset_link}

    If you did not request this, please ignore this email.

    Thanks,
    The KhetiHal Team
    """
    html = f"""
    <html>
        <body>
            <p>Dear KhetiHal User,</p>
            <p>You have requested to reset your password.</p>
            <p><a href="{reset_link}">Reset My Password</a></p>
            <p>If you did not request this, please ignore this email.</p>
            <p>Thanks,<br>The KhetiHal Team</p>
        </body>
    </html>
    """
    part1 = MIMEText(text, 'plain')
    part2 = MIMEText(html, 'html')

    msg.attach(part1)
    msg.attach(part2)

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            smtp.send_message(msg)
        app.logger.info(f"Password reset email sent to {email}")
        return True
    except Exception as e:
        app.logger.error(f"Failed to send email to {email}: {e}")
        return False

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# --- Google Sheets Helper Functions ---

def get_next_sheet_id(worksheet):
    """Generates the next sequential ID for a sheet, assuming 'id' is the first column."""
    try:
        # Get all values from the first column (ID column)
        ids = worksheet.col_values(1)
        # Filter out header and empty strings, convert to int, find max
        numeric_ids = [int(i) for i in ids[1:] if i.isdigit()] # Skip header, check if digit
        if numeric_ids:
            return max(numeric_ids) + 1
        return 1 # If no numeric IDs, start from 1
    except Exception as e:
        app.logger.error(f"Error getting next sheet ID: {e}")
        return 1 # Fallback to 1

def get_all_sheet_products():
    """Retrieves all products from the Google Sheet, with robust error handling for data types."""
    if not products_sheet: return []
    try:
        records = products_sheet.get_all_records()
        processed_records = []
        for record in records:
            # Create a mutable copy to modify values
            processed_record = record.copy()
            
            # Handle 'id' - default to 0 if invalid
            try:
                processed_record['id'] = int(record.get('id', 0))
            except ValueError:
                app.logger.warning(f"Product ID '{record.get('id')}' is invalid. Defaulting to 0 for record: {record}")
                processed_record['id'] = 0 

            # Handle 'price' - default to 0.0 if invalid
            try:
                processed_record['price'] = float(record.get('price', 0.0))
            except ValueError:
                app.logger.warning(f"Product price '{record.get('price')}' is invalid. Defaulting to 0.0 for record: {record}")
                processed_record['price'] = 0.0 

            # Handle 'stock' - default to 0 if invalid
            try:
                processed_record['stock'] = int(record.get('stock', 0))
            except ValueError:
                app.logger.warning(f"Product stock '{record.get('stock')}' is invalid. Defaulting to 0 for record: {record}")
                processed_record['stock'] = 0 
            
            # Ensure name, description, and image_url are strings, even if empty or None in sheet
            processed_record['name'] = str(record.get('name', '')).strip()
            processed_record['description'] = str(record.get('description', '')).strip()
            processed_record['image_url'] = str(record.get('image_url', '')).strip()

            processed_records.append(processed_record)
        return processed_records
    except Exception as e:
        app.logger.error(f"Error reading products from Google Sheet: {e}")
        return []

def add_sheet_product(product_data):
    """Adds a new product to the Google Sheet."""
    if not products_sheet: return False
    try:
        # Get next ID and add to data
        product_data['id'] = get_next_sheet_id(products_sheet)
        # Ensure data matches sheet headers order: id, name, description, price, image_url, stock
        row_data = [
            product_data.get('id'),
            product_data.get('name'),
            product_data.get('description'),
            product_data.get('price'),
            product_data.get('image_url'),
            product_data.get('stock')
        ]
        products_sheet.append_row(row_data)
        app.logger.info(f"Added product to Google Sheet: {product_data.get('name')}")
        return True
    except Exception as e:
        app.logger.error(f"Error adding product to Google Sheet: {e}")
        return False

def update_sheet_product(product_id, product_data):
    """Updates an existing product in the Google Sheet by ID."""
    if not products_sheet: return False
    try:
        # Find the row by ID. Assuming ID is in the first column.
        cell = products_sheet.find(str(product_id), in_column=1) # Find cell with product_id in first column
        if cell:
            row_index = cell.row
            # Prepare data to update. Ensure order matches sheet headers.
            # Only update provided fields, keep others as they are if not provided.
            # For simplicity, we'll fetch current row and update specific cells.
            current_row_values = products_sheet.row_values(row_index)
            # Assuming headers are: id, name, description, price, image_url, stock
            headers = products_sheet.row_values(1) # Get headers from first row

            update_cells = []
            for col_index, header in enumerate(headers):
                if header in product_data:
                    # gspread uses 1-based indexing for columns
                    update_cells.append(gspread.Cell(row_index, col_index + 1, product_data[header]))
            
            if update_cells:
                products_sheet.update_cells(update_cells)
                app.logger.info(f"Updated product {product_id} in Google Sheet.")
                return True
            return False # No fields to update
        else:
            app.logger.warning(f"Product with ID {product_id} not found in Google Sheet for update.")
            return False
    except Exception as e:
        app.logger.error(f"Error updating product {product_id} in Google Sheet: {e}")
        return False

def delete_sheet_product(product_id):
    """Deletes a product from the Google Sheet by ID."""
    if not products_sheet: return False
    try:
        cell = products_sheet.find(str(product_id), in_column=1)
        if cell:
            products_sheet.delete_rows(cell.row)
            app.logger.info(f"Deleted product {product_id} from Google Sheet.")
            return True
        else:
            app.logger.warning(f"Product with ID {product_id} not found in Google Sheet for deletion.")
            return False
    except Exception as e:
        app.logger.error(f"Error deleting product {product_id} from Google Sheet: {e}")
        return False

def get_all_sheet_orders():
    """Retrieves all orders from the Google Sheet."""
    if not orders_sheet: return []
    try:
        records = orders_sheet.get_all_records()
        # Convert numeric fields and parse items_json
        for record in records:
            try:
                record['id'] = int(record.get('id', 0))
                record['user_id'] = int(record.get('user_id', 0))
                record['total_amount'] = float(record.get('total_amount', 0.0))
                # Parse items_json back to a Python list/dict
                record['items'] = json.loads(record.get('items_json', '[]'))
            except (ValueError, json.JSONDecodeError):
                app.logger.warning(f"Skipping order with invalid numeric or JSON data: {record}")
                continue
        return records
    except Exception as e:
        app.logger.error(f"Error reading orders from Google Sheet: {e}")
        return []

def update_sheet_order_status(order_id, new_status):
    """Updates the status of an order in the Google Sheet by ID."""
    if not orders_sheet: return False
    try:
        cell = orders_sheet.find(str(order_id), in_column=1) # Assuming ID is in the first column
        if cell:
            # Find the column index for 'status'
            headers = orders_sheet.row_values(1)
            try:
                status_col_index = headers.index('status') + 1 # +1 for 1-based indexing
            except ValueError:
                app.logger.error("'status' column not found in Orders Google Sheet headers.")
                return False

            orders_sheet.update_cell(cell.row, status_col_index, new_status)
            app.logger.info(f"Updated order {order_id} status to {new_status} in Google Sheet.")
            return True
        else:
            app.logger.warning(f"Order with ID {order_id} not found in Google Sheet for status update.")
            return False
    except Exception as e:
        app.logger.error(f"Error updating order {order_id} status in Google Sheet: {e}")
        return False


# --- Routes for Serving HTML Pages (Customer-Facing) ---
@app.route('/')
def serve_index():
    return render_template('index.html', is_logged_in='user_id' in session)

@app.route('/products.html')
def serve_products():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM products")
    products = cursor.fetchall()
    return render_template('products.html', products=products, is_logged_in='user_id' in session)

@app.route('/cart.html')
@login_required
def serve_cart():
    return render_template('cart.html', is_logged_in='user_id' in session)

@app.route('/checkout.html')
@login_required
def serve_checkout():
    return render_template('checkout.html', is_logged_in='user_id' in session)

@app.route('/payment.html')
@login_required
def serve_payment():
    user_id = session.get('user_id')
    app.logger.info(f"Serving payment.html for user_id: {user_id}")
    db = get_db()
    cursor = db.cursor()
    cart_items = cursor.execute("""
        SELECT ci.product_id, ci.quantity, p.name, p.price, p.image_url
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
    """, (user_id,)).fetchall()
    app.logger.info(f"Payment page load: User {user_id} has {len(cart_items)} items in cart from DB.")
    return render_template('payment.html', is_logged_in='user_id' in session)

@app.route('/login.html')
def serve_login():
    return render_template('login.html', is_logged_in='user_id' in session)

@app.route('/register.html')
def serve_register():
    return render_template('register.html', is_logged_in='user_id' in session)

@app.route('/forgot_password.html')
def serve_forgot_password():
    return render_template('forgot_password.html', is_logged_in='user_id' in session)

@app.route('/reset_password.html')
def serve_reset_password():
    return render_template('reset_password.html', is_logged_in='user_id' in session)

@app.route('/about.html')
def serve_about():
    return render_template('about.html', is_logged_in='user_id' in session)

@app.route('/services.html')
def serve_services():
    return render_template('services.html', is_logged_in='user_id' in session)

@app.route('/contact.html')
def serve_contact():
    return render_template('contact.html', is_logged_in='user_id' in session)

@app.route('/profile.html')
@login_required
def serve_profile():
    return render_template('profile.html', is_logged_in='user_id' in session)

@app.route('/order_history.html')
@login_required
def serve_order_history():
    return render_template('order_history.html', is_logged_in='user_id' in session)

@app.route('/settings.html')
@login_required
def serve_settings():
    return render_template('settings.html', is_logged_in='user_id' in session)

@app.route('/order_confirmation.html')
@login_required
def serve_order_confirmation():
    order_id = request.args.get('order_id')
    if not order_id:
        return redirect(url_for('serve_order_history'))
    return render_template('order_confirmation.html', is_logged_in='user_id' in session, order_id=order_id)

# --- ADMIN ROUTES (SQLite-based for products/orders if not using Sheets) ---
@app.route('/admin/login.html')
def serve_admin_login():
    return render_template('admin_login.html', is_logged_in='user_id' in session)

@app.route('/admin/dashboard.html')
@admin_required
def serve_admin_dashboard():
    return render_template('admin_dashboard.html', is_logged_in='user_id' in session)

@app.route('/admin/import_products.html') # This is for SQLite product import
@admin_required
def serve_import_products_page():
    app.logger.info(f"Serving SQLite product import page for admin user {session.get('user_id')}")
    return render_template('import_products.html', is_logged_in='user_id' in session)

@app.route('/admin/manage_orders.html') # This is for SQLite order management
@admin_required
def serve_admin_manage_orders():
    app.logger.info(f"Serving SQLite order management page for admin user {session.get('user_id')}")
    return render_template('admin_manage_orders.html', is_logged_in='user_id' in session)

# --- NEW ADMIN ROUTES FOR GOOGLE SHEETS MANAGEMENT ---
@app.route('/admin/sheets/products.html')
@admin_required
def serve_admin_sheets_products():
    """Serves the admin page for managing products via Google Sheets."""
    return render_template('admin_sheets_products.html', is_logged_in='user_id' in session)

@app.route('/admin/sheets/orders.html')
@admin_required
def serve_admin_sheets_orders():
    """Serves the admin page for managing orders via Google Sheets."""
    return render_template('admin_sheets_orders.html', is_logged_in='user_id' in session)


# --- API Endpoints (Customer-Facing - Interact with SQLite) ---

@app.route('/api/register', methods=['POST'])
def api_register():
    db = get_db()
    cursor = db.cursor()
    username = request.form['username']
    email = request.form['email']
    password = request.form['password']

    if not username or not email or not password:
        return jsonify({'success': False, 'message': 'All fields are required.'}), 400

    hashed_password = generate_password_hash(password)

    try:
        cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
        if cursor.fetchone():
            app.logger.warning(f"Registration failed: User with email {email} or username {username} already exists.")
            return jsonify({'success': False, 'message': 'User with that email or username already exists.'}), 409

        cursor.execute("INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)",
                       (username, email, hashed_password, 0)) 
        db.commit()
        app.logger.info(f"User registered: {username} ({email})")
        return jsonify({'success': True, 'message': 'Registration successful! Please log in.'}), 201
    except Exception as e:
        app.logger.error(f"Registration error: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred during registration.'}), 500

@app.route('/api/login', methods=['POST'])
def api_login():
    db = get_db()
    cursor = db.cursor()
    email = request.form['email']
    password = request.form['password']

    user = cursor.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if user and check_password_hash(user['password_hash'], password):
        if user['is_admin'] == 1:
            app.logger.warning(f"Admin user {user['username']} attempted to log in via customer login.")
            return jsonify({'success': False, 'message': 'Administrators must use the admin login portal.'}), 403
        
        session['user_id'] = user['id']
        app.logger.info(f"Customer logged in: {user['username']}")
        return jsonify({'success': True, 'message': 'Login successful!', 'redirect': url_for('serve_index')}), 200
    else:
        app.logger.warning(f"Customer login failed for email: {email}")
        return jsonify({'success': False, 'message': 'Invalid email or password.'}), 401

@app.route('/api/admin_login', methods=['POST'])
def api_admin_login():
    db = get_db()
    cursor = db.cursor()
    email = request.form['email']
    password = request.form['password']

    user = cursor.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    
    app.logger.info(f"Admin login attempt for email: {email}")
    if user:
        app.logger.info(f"User found: {user['email']}, is_admin: {user['is_admin']}")
        password_matches = check_password_hash(user['password_hash'], password)
        app.logger.info(f"Password check result: {password_matches}")

        if password_matches and user['is_admin'] == 1:
            session['user_id'] = user['id']
            app.logger.info(f"Admin logged in successfully: {user['username']}")
            return jsonify({'success': True, 'message': 'Admin login successful!', 'redirect': url_for('serve_admin_dashboard')}), 200
        else:
            if not password_matches:
                app.logger.warning(f"Admin login failed for {email}: Incorrect password.")
            elif user['is_admin'] != 1:
                app.logger.warning(f"Admin login failed for {email}: User is not an admin.")
            return jsonify({'success': False, 'message': 'Invalid email or password.'}), 401
    else:
        app.logger.warning(f"Admin login failed: User with email {email} not found.")
        return jsonify({'success': False, 'message': 'Invalid email or password.'}), 401


@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    user_id = session.pop('user_id', None)
    if user_id:
        app.logger.info(f"User {user_id} logged out.")
        return jsonify({'success': True, 'message': 'You have been logged out.'}), 200
    return jsonify({'success': False, 'message': 'No active session to log out from.'}), 400

# NEW: Endpoint to check login status
@app.route('/api/check_login_status', methods=['GET'])
def check_login_status():
    """Returns whether a user is currently logged in."""
    is_logged_in = 'user_id' in session
    return jsonify({'is_logged_in': is_logged_in}), 200


@app.route('/api/forgot_password', methods=['POST'])
def api_forgot_password():
    db = get_db()
    cursor = db.cursor()
    email = request.form['email']

    user = cursor.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        app.logger.warning(f"Forgot password request for non-existent email: {email}")
        return jsonify({'success': True, 'message': 'If an account with that email exists, a password reset link has been sent.'}), 200

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=1)

    try:
        cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", (user['id'],))
        cursor.execute("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
                       (user['id'], token, expires_at))
        db.commit()

        if send_reset_email(email, token):
            app.logger.info(f"Password reset token generated and email sent for user {user['id']}.")
            return jsonify({'success': True, 'message': 'If an account with that email exists, a password reset link has been sent.'}), 200
        else:
            return jsonify({'success': False, 'message': 'Failed to send password reset email. Please try again later.'}), 500
    except Exception as e:
        app.logger.error(f"Error generating or saving reset token for user {user['id']}: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred.'}), 500

@app.route('/api/reset_password', methods=['POST'])
def api_reset_password():
    db = get_db()
    cursor = db.cursor()
    token = request.form['token']
    new_password = request.form['newPassword']

    if not token or not new_password:
        return jsonify({'success': False, 'message': 'Token and new password are required.'}), 400

    reset_entry = cursor.execute("SELECT * FROM password_reset_tokens WHERE token = ?", (token,)).fetchone()

    if not reset_entry:
        app.logger.warning(f"Password reset failed: Invalid token {token}.")
        return jsonify({'success': False, 'message': 'Invalid or expired reset token.'}), 400

    if datetime.now() > datetime.strptime(reset_entry['expires_at'], '%Y-%m-%d %H:%M:%S'):
        app.logger.warning(f"Password reset failed: Expired token {token}.")
        cursor.execute("DELETE FROM password_reset_tokens WHERE token = ?", (token,)) 
        db.commit()
        return jsonify({'success': False, 'message': 'Invalid or expired reset token.'}), 400

    hashed_password = generate_password_hash(new_password)

    try:
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hashed_password, reset_entry['user_id']))
        cursor.execute("DELETE FROM password_reset_tokens WHERE token = ?", (token,))
        db.commit()
        app.logger.info(f"Password for user {reset_entry['user_id']} reset successfully.")
        return jsonify({'success': True, 'message': 'Your password has been reset successfully. You can now log in.'}), 200
    except Exception as e:
        app.logger.error(f"Error resetting password for user {reset_entry['user_id']}: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred during password reset.'}), 500

@app.route('/api/contact_us', methods=['POST'])
def api_contact_us():
    name = request.form['name']
    email = request.form['email']
    message = request.form['message']

    if not name or not email or not message:
        return jsonify({'success': False, 'message': 'All fields are required.'}), 400

    app.logger.info(f"Contact Form Submission:\nName: {name}\nEmail: {email}\nMessage: {message}")

    return jsonify({'success': True, 'message': 'Your message has been sent successfully!'}), 200

@app.route('/api/add_to_cart', methods=['POST'])
@login_required
def api_add_to_cart():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']
    product_id = request.form.get('product_id', type=int)
    quantity = request.form.get('quantity', type=int)

    if not product_id or not quantity or quantity <= 0:
        return jsonify({'success': False, 'message': 'Invalid product or quantity.'}), 400

    try:
        existing_item = cursor.execute(
            "SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?",
            (user_id, product_id)
        ).fetchone()

        if existing_item:
            new_quantity = existing_item['quantity'] + quantity
            cursor.execute(
                "UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?",
                (new_quantity, user_id, product_id)
            )
            message = f"Product quantity updated to {new_quantity} in cart."
        else:
            cursor.execute(
                "INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)",
                (user_id, product_id, quantity)
            )
            message = "Product added to cart successfully."
        
        db.commit()
        app.logger.info(f"User {user_id} cart updated for product {product_id}.")
        # Fetch the new quantity from the database to ensure accuracy
        updated_item = cursor.execute(
            "SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?",
            (user_id, product_id)
        ).fetchone()
        new_quantity = updated_item['quantity'] if updated_item else 0
        return jsonify({'success': True, 'message': message, 'new_quantity': new_quantity}), 200
    except Exception as e:
        app.logger.error(f"Error adding to cart for user {user_id}, product {product_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to add product to cart.'}), 500

@app.route('/api/get_cart_count')
@login_required
def api_get_cart_count():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']

    try:
        total_quantity = cursor.execute(
            "SELECT SUM(quantity) FROM cart_items WHERE user_id = ?",
            (user_id,)
        ).fetchone()[0] or 0
        
        return jsonify({'success': True, 'count': total_quantity}), 200
    except Exception as e:
        app.logger.error(f"Error getting cart count for user {user_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to retrieve cart count.', 'count': 0}), 500

@app.route('/api/get_cart_items')
@login_required
def api_get_cart_items():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']
    app.logger.info(f"API call: get_cart_items for user_id: {user_id}")

    try:
        cart_items = cursor.execute("""
            SELECT ci.product_id, ci.quantity, p.name, p.price, p.image_url
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = ?
        """, (user_id,)).fetchall()

        items_list = [dict(item) for item in cart_items]
        app.logger.info(f"API call: get_cart_items returning {len(items_list)} items for user {user_id}.")
        return jsonify({'success': True, 'items': items_list}), 200
    except Exception as e:
        app.logger.error(f"Error getting cart items for user {user_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to retrieve cart items.', 'items': []}), 500

@app.route('/api/update_cart_quantity', methods=['POST'])
@login_required
def api_update_cart_quantity():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']
    product_id = request.form.get('product_id', type=int)
    change_type = request.form.get('change_type')

    if not product_id or change_type not in ['increase', 'decrease']:
        return jsonify({'success': False, 'message': 'Invalid product or change type.'}), 400

    try:
        current_item = cursor.execute(
            "SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?",
            (user_id, product_id)
        ).fetchone()

        if not current_item:
            return jsonify({'success': False, 'message': 'Product not found in cart.'}), 404

        current_quantity = current_item['quantity']
        new_quantity = current_quantity

        if change_type == 'increase':
            new_quantity += 1
            message = "Product quantity increased."
        elif change_type == 'decrease':
            new_quantity -= 1
            message = "Product quantity decreased."

        if new_quantity <= 0:
            cursor.execute(
                "DELETE FROM cart_items WHERE user_id = ? AND product_id = ?",
                (user_id, product_id)
            )
            message = "Product removed from cart."
            new_quantity = 0
        else:
            cursor.execute(
                "UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?",
                (new_quantity, user_id, product_id)
            )
        
        db.commit()
        app.logger.info(f"User {user_id} updated product {product_id} quantity to {new_quantity}.")
        return jsonify({'success': True, 'message': message, 'new_quantity': new_quantity}), 200
    except Exception as e:
        app.logger.error(f"Error updating cart quantity for user {user_id}, product {product_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to update cart quantity.'}), 500

@app.route('/api/remove_from_cart', methods=['POST'])
@login_required
def api_remove_from_cart():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']
    product_id = request.form.get('product_id', type=int)

    if not product_id:
        return jsonify({'success': False, 'message': 'Invalid product ID.'}), 400

    try:
        cursor.execute(
            "DELETE FROM cart_items WHERE user_id = ? AND product_id = ?",
            (user_id, product_id)
        )
        db.commit()
        if cursor.rowcount > 0:
            app.logger.info(f"User {user_id} removed product {product_id} from cart.")
            return jsonify({'success': True, 'message': 'Product removed from cart.'}), 200
        else:
            app.logger.warning(f"User {user_id} tried to remove non-existent product {product_id} from cart.")
            return jsonify({'success': False, 'message': 'Product not found in cart.'}), 404
    except Exception as e:
        app.logger.error(f"Error removing from cart for user {user_id}, product {product_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to remove product from cart.'}), 500

@app.route('/api/save_shipping_info', methods=['POST'])
@login_required
def api_save_shipping_info():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']

    full_name = request.form.get('fullName')
    address_line1 = request.form.get('addressLine1')
    address_line2 = request.form.get('addressLine2')
    address_line3 = request.form.get('addressLine3')
    city = request.form.get('city')
    state = request.form.get('state')
    zip_code = request.form.get('zipCode')
    phone = request.form.get('phone')

    if not all([full_name, address_line1, address_line2, city, state, zip_code, phone]):
        return jsonify({'success': False, 'message': 'All required shipping fields must be filled.'}), 400
    
    existing_info = cursor.execute("SELECT * FROM shipping_info WHERE user_id = ?", (user_id,)).fetchone()

    try:
        if existing_info:
            cursor.execute("""
                UPDATE shipping_info
                SET full_name = ?, address_line1 = ?, address_line2 = ?, address_line3 = ?,
                    city = ?, state = ?, zip_code = ?, phone = ?
                WHERE user_id = ?
            """, (full_name, address_line1, address_line2, address_line3, city, state, zip_code, phone, user_id))
            message = 'Shipping information updated successfully.'
            app.logger.info(f"User {user_id} updated shipping info.")
        else:
            cursor.execute("""
                INSERT INTO shipping_info
                (user_id, full_name, address_line1, address_line2, address_line3, city, state, zip_code, phone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, full_name, address_line1, address_line2, address_line3, city, state, zip_code, phone))
            message = 'Shipping information saved successfully.'
            app.logger.info(f"User {user_id} saved new shipping info.")
        
        db.commit()
        return jsonify({'success': True, 'message': message, 'redirect': url_for('serve_payment')}), 200
    except Exception as e:
        app.logger.error(f"Error saving shipping info for user {user_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to save shipping information.'}), 500

@app.route('/api/get_shipping_info')
@login_required
def api_get_shipping_info():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']

    try:
        shipping_info = cursor.execute("SELECT * FROM shipping_info WHERE user_id = ?", (user_id,)).fetchone()
        if shipping_info:
            return jsonify({'success': True, 'shipping_info': dict(shipping_info)}), 200
        else:
            return jsonify({'success': False, 'message': 'No shipping information found for this user.'}), 404
    except Exception as e:
        app.logger.error(f"Error retrieving shipping info for user {user_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to retrieve shipping information.'}), 500

@app.route('/api/get_user_profile')
@login_required
def api_get_user_profile():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']

    try:
        user = cursor.execute("SELECT id, username, email FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            return jsonify({'success': False, 'message': 'User not found.'}), 404

        shipping_info = cursor.execute("SELECT * FROM shipping_info WHERE user_id = ?", (user_id,)).fetchone()
        
        profile_data = dict(user)
        profile_data['shipping_info'] = dict(shipping_info) if shipping_info else {}

        return jsonify({'success': True, 'profile': profile_data}), 200
    except Exception as e:
        app.logger.error(f"Error retrieving user profile for user {user_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to retrieve user profile.'}), 500

@app.route('/api/update_user_profile', methods=['POST'])
@login_required
def api_update_user_profile():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']
    username = request.form.get('username')
    email = request.form.get('email')

    if not username or not email:
        return jsonify({'success': False, 'message': 'Username and email are required.'}), 400

    try:
        current_user = cursor.execute("SELECT username, email FROM users WHERE id = ?", (user_id,)).fetchone()
        
        if current_user['username'] != username:
            if cursor.execute("SELECT id FROM users WHERE username = ? AND id != ?", (username, user_id)).fetchone():
                return jsonify({'success': False, 'message': 'Username already taken.'}), 409
        
        if current_user['email'] != email:
            if cursor.execute("SELECT id FROM users WHERE email = ? AND id != ?", (email, user_id)).fetchone():
                return jsonify({'success': False, 'message': 'Email already registered.'}), 409

        cursor.execute("UPDATE users SET username = ?, email = ? WHERE id = ?", (username, email, user_id))
        db.commit()
        app.logger.info(f"User {user_id} profile updated.")
        return jsonify({'success': True, 'message': 'Profile updated successfully!'}), 200
    except Exception as e:
        app.logger.error(f"Error updating user {user_id} profile: {e}")
        return jsonify({'success': False, 'message': 'Failed to update profile.'}), 500

@app.route('/api/change_password', methods=['POST'])
@login_required
def api_change_password():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']
    current_password = request.form.get('currentPassword')
    new_password = request.form.get('newPassword')

    if not current_password or not new_password:
        return jsonify({'success': False, 'message': 'Current and new passwords are required.'}), 400
    
    user = cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()

    if user and check_password_hash(user['password_hash'], current_password):
        hashed_new_password = generate_password_hash(new_password)
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hashed_new_password, user_id))
        db.commit()
        app.logger.info(f"User {user_id} changed password successfully.")
        return jsonify({'success': True, 'message': 'Password changed successfully!'}), 200
    else:
        app.logger.warning(f"User {user_id} failed to change password (incorrect current password).")
        return jsonify({'success': False, 'message': 'Incorrect current password.'}), 401

@app.route('/api/get_order_history')
@login_required
def api_get_order_history():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']

    try:
        orders = cursor.execute("""
            SELECT id, order_date, total_amount, status, payment_method,
                   full_name, address_line1, address_line2, address_line3,
                   city, state, zip_code, phone
            FROM orders
            WHERE user_id = ?
            ORDER BY order_date DESC
        """, (user_id,)).fetchall()

        orders_list = []
        for order in orders:
            order_dict = dict(order)
            items = cursor.execute("""
                SELECT product_id, product_name, product_price, quantity, image_url
                FROM order_items
                JOIN products ON order_items.product_id = products.id
                WHERE order_id = ?
            """, (order['id'],)).fetchall()
            order_dict['items'] = [dict(item) for item in items]
            orders_list.append(order_dict)
        
        app.logger.info(f"Retrieved {len(orders_list)} orders for user {user_id}.")
        return jsonify({'success': True, 'orders': orders_list}), 200
    except Exception as e:
        app.logger.error(f"Error retrieving order history for user {user_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to retrieve order history.', 'orders': []}), 500

@app.route('/api/get_order_details/<int:order_id>')
@login_required
def api_get_order_details(order_id):
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']

    try:
        order = cursor.execute("""
            SELECT id, order_date, total_amount, status, payment_method,
                   full_name, address_line1, address_line2, address_line3,
                   city, state, zip_code, phone
            FROM orders
            WHERE id = ? AND user_id = ?
        """, (order_id, user_id)).fetchone()

        if not order:
            app.logger.warning(f"Order {order_id} not found or does not belong to user {user_id}.")
            return jsonify({'success': False, 'message': 'Order not found.'}), 404
        
        order_dict = dict(order)
        
        items = cursor.execute("""
            SELECT product_id, product_name, product_price, quantity, image_url
            FROM order_items
            JOIN products ON order_items.product_id = products.id
            WHERE order_id = ?
        """, (order_id,)).fetchall()
        order_dict['items'] = [dict(item) for item in items]
        
        app.logger.info(f"Retrieved details for order {order_id} for user {user_id}.")
        return jsonify({'success': True, 'order': order_dict}), 200
    except Exception as e:
        app.logger.error(f"Error retrieving order details for order {order_id}, user {user_id}: {e}")
        return jsonify({'success': False, 'message': 'Failed to retrieve order details.'}), 500

@app.route('/api/admin/get_all_orders')
@admin_required
def api_admin_get_all_orders():
    db = get_db()
    cursor = db.cursor()

    try:
        orders = cursor.execute("""
            SELECT o.id, o.order_date, o.total_amount, o.status, o.payment_method,
                   o.full_name, o.address_line1, o.address_line2, o.address_line3,
                   o.city, o.state, o.zip_code, o.phone,
                   u.username as customer_username, u.email as customer_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.order_date DESC
        """).fetchall()

        orders_list = []
        for order in orders:
            order_dict = dict(order)
            items = cursor.execute("""
                SELECT product_name, product_price, quantity
                FROM order_items
                WHERE order_id = ?
            """, (order['id'],)).fetchall()
            order_dict['items'] = [dict(item) for item in items]
            orders_list.append(order_dict)
        
        app.logger.info(f"Admin retrieved {len(orders_list)} total orders.")
        return jsonify({'success': True, 'orders': orders_list}), 200
    except Exception as e:
        app.logger.error(f"Error retrieving all orders for admin: {e}")
        return jsonify({'success': False, 'message': 'Failed to retrieve all orders.', 'orders': []}), 500


@app.route('/api/update_order_status', methods=['POST'])
@admin_required
def api_update_order_status():
    db = get_db()
    cursor = db.cursor()
    order_id = request.form.get('order_id', type=int)
    new_status = request.form.get('status')

    if not order_id or not new_status:
        return jsonify({'success': False, 'message': 'Order ID and new status are required.'}), 400

    allowed_statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    if new_status not in allowed_statuses:
        return jsonify({'success': False, 'message': 'Invalid status provided.'}), 400

    try:
        order = cursor.execute("SELECT status FROM orders WHERE id = ?", (order_id,)).fetchone()
        if not order:
            app.logger.warning(f"Admin attempted to update status of non-existent order {order_id}.")
            return jsonify({'success': False, 'message': 'Order not found.'}), 404
        
        current_status = order['status']
        if current_status == new_status:
            return jsonify({'success': True, 'message': f"Order was already {current_status}. No change needed."}), 200

        cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
        db.commit()
        app.logger.info(f"Order {order_id} status updated to {new_status} by admin.")
        return jsonify({'success': True, 'message': f"Order status updated to {new_status}."}), 200
    except Exception as e:
        app.logger.error(f"Error updating order {order_id} status by admin: {e}")
        return jsonify({'success': False, 'message': 'Failed to update order status.'}), 500

@app.route('/api/search_products')
def api_search_products():
    db = get_db()
    cursor = db.cursor()
    query = request.args.get('query', '').lower()
    
    # This endpoint is now primarily for SQLite-based product search if needed elsewhere.
    # The products.html page directly calls /api/admin/sheets/products for its main display.

    if not query:
        cursor.execute("SELECT * FROM products ORDER BY name")
        products_data = cursor.fetchall()
        return jsonify({'success': True, 'products': [dict(p) for p in products_data], 'message': "Showing all products."}), 200

    cursor.execute("""
        SELECT * FROM products 
        WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ? 
        ORDER BY name
    """, (f'%{query}%', f'%{query}%'))
    
    results = cursor.fetchall()
    
    if results:
        return jsonify({'success': True, 'products': [dict(p) for p in results], 'message': f"Found {len(results)} results for '{query}'."}), 200
    else:
        return jsonify({'success': False, 'message': f"No products found matching '{query}'.", 'products': []}), 200

@app.route('/api/place_order', methods=['POST'])
@login_required
def api_place_order():
    db = get_db()
    cursor = db.cursor()
    user_id = session['user_id']
    payment_method = request.form.get('payment_method', 'unknown')

    try:
        cart_items = cursor.execute("""
            SELECT ci.product_id, ci.quantity, p.name, p.price, p.image_url
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = ?
        """, (user_id,)).fetchall()

        if not cart_items:
            app.logger.warning(f"User {user_id} attempted to place an order with an empty cart.")
            return jsonify({'success': False, 'message': 'Your cart is empty. Please add items before placing an order.'}), 400

        shipping_info = cursor.execute("SELECT * FROM shipping_info WHERE user_id = ?", (user_id,)).fetchone()
        if not shipping_info:
            app.logger.warning(f"User {user_id} attempted to place an order without shipping info.")
            return jsonify({'success': False, 'message': 'Please provide your shipping information before placing an order.'}), 400

        total_amount = sum(item['quantity'] * item['price'] for item in cart_items)

        cursor.execute("""
            INSERT INTO orders (user_id, total_amount, status, payment_method,
                                full_name, address_line1, address_line2, address_line3,
                                city, state, zip_code, phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            total_amount,
            'pending',
            payment_method,
            shipping_info['full_name'],
            shipping_info['address_line1'],
            shipping_info['address_line2'],
            shipping_info['address_line3'],
            shipping_info['city'],
            shipping_info['state'],
            shipping_info['zip_code'],
            shipping_info['phone']
        ))
        order_id = cursor.lastrowid
        app.logger.info(f"Order {order_id} created for user {user_id}.")

        # Prepare items for storage in Google Sheet (as JSON string)
        items_for_sheet = []
        for item in cart_items:
            item_dict = dict(item)
            # Remove image_url if not needed in sheet items_json to keep it concise
            item_dict.pop('image_url', None) 
            items_for_sheet.append(item_dict)
        items_json_string = json.dumps(items_for_sheet)

        # 4. Insert into order_items table (SQLite) and update product stock (SQLite)
        for item in cart_items:
            cursor.execute("""
                INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity)
                VALUES (?, ?, ?, ?, ?)
            """, (order_id, item['product_id'], item['name'], item['price'], item['quantity']))
            
            # Update product stock in SQLite
            cursor.execute("UPDATE products SET stock = stock - ? WHERE id = ?", (item['quantity'], item['product_id']))
        app.logger.info(f"Inserted {len(cart_items)} items for order {order_id} into SQLite and updated stock.")

        # 5. Add order to Google Sheet (if sheets are initialized)
        if orders_sheet:
            try:
                # Fetch customer details for the sheet
                customer_user = cursor.execute("SELECT username, email FROM users WHERE id = ?", (user_id,)).fetchone()
                customer_username = customer_user['username'] if customer_user else 'N/A'
                customer_email = customer_user['email'] if customer_user else 'N/A'

                sheet_order_data = [
                    get_next_sheet_id(orders_sheet), # Generate new ID for the sheet
                    user_id,
                    customer_username,
                    customer_email,
                    datetime.now().isoformat(), # Use current time for sheet order date
                    total_amount,
                    'pending',
                    payment_method,
                    shipping_info['full_name'],
                    shipping_info['address_line1'],
                    shipping_info['address_line2'],
                    shipping_info['address_line3'],
                    shipping_info['city'],
                    shipping_info['state'],
                    shipping_info['zip_code'],
                    shipping_info['phone'],
                    items_json_string
                ]
                orders_sheet.append_row(sheet_order_data)
                app.logger.info(f"Order {order_id} also recorded in Google Sheet.")
            except Exception as sheet_e:
                app.logger.error(f"Failed to record order {order_id} in Google Sheet: {sheet_e}")
                # Don't rollback SQLite transaction if sheet fails, as order is placed.

        # 6. Clear the user's cart (SQLite)
        cursor.execute("DELETE FROM cart_items WHERE user_id = ?", (user_id,))
        app.logger.info(f"Cart cleared for user {user_id}.")

        db.commit() # Final commit for SQLite operations
        
        return jsonify({
            'success': True,
            'message': 'Order placed successfully!',
            'order_id': order_id,
            'redirect': url_for('serve_order_confirmation', order_id=order_id)
        }), 200

    except Exception as e:
        db.rollback()
        app.logger.error(f"Error placing order for user {user_id}: {e}")
        return jsonify({'success': False, 'message': f'Failed to place order: {e}'}), 500

@app.route('/api/import_products', methods=['POST'])
@admin_required
def api_import_products():
    """
    Handles CSV file upload for importing/updating product data into SQLite.
    Expected CSV columns: name, description, price, image_url, stock
    """
    user_id = session.get('user_id')
    app.logger.info(f"Admin user {user_id} attempting to import products into SQLite.")

    if 'file' not in request.files:
        app.logger.warning("No file part in import products request.")
        return jsonify({'success': False, 'message': 'No file part'}), 400
    
    file = request.files['file']

    if file.filename == '':
        app.logger.warning("No selected file for import products.")
        return jsonify({'success': False, 'message': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        app.logger.info(f"File '{filename}' saved temporarily to '{filepath}'.")

        db = get_db()
        cursor = db.cursor()
        imported_count = 0
        updated_count = 0
        errors = []

        try:
            df = pd.read_csv(filepath)
            
            expected_columns = ['name', 'description', 'price', 'image_url', 'stock']
            if not all(col in df.columns for col in expected_columns):
                os.remove(filepath)
                return jsonify({'success': False, 'message': 'CSV must contain "name", "description", "price", "image_url", "stock" columns.'}), 400

            for index, row in df.iterrows():
                try:
                    name = str(row['name']).strip()
                    description = str(row['description']).strip() if pd.notna(row['description']) else None
                    price = float(row['price'])
                    image_url = str(row['image_url']).strip() if pd.notna(row['image_url']) else None
                    stock = int(row['stock'])

                    if not name or price <= 0 or stock < 0:
                        errors.append(f"Row {index + 1}: Invalid data (name, price, or stock). Skipping.")
                        continue

                    existing_product = cursor.execute("SELECT id FROM products WHERE name = ?", (name,)).fetchone()

                    if existing_product:
                        cursor.execute("""
                            UPDATE products SET description = ?, price = ?, image_url = ?, stock = ?
                            WHERE id = ?
                        """, (description, price, image_url, stock, existing_product['id']))
                        updated_count += 1
                    else:
                        cursor.execute("""
                            INSERT INTO products (name, description, price, image_url, stock)
                            VALUES (?, ?, ?, ?, ?)
                        """, (name, description, price, image_url, stock))
                        imported_count += 1
                    db.commit()
                except Exception as row_e:
                    errors.append(f"Row {index + 1}: Error processing row - {row_e}. Data: {row.to_dict()}")
                    db.rollback()
                    app.logger.error(f"Error processing CSV row: {row_e}")
            
            os.remove(filepath)
            app.logger.info(f"CSV import complete. Imported: {imported_count}, Updated: {updated_count}, Errors: {len(errors)}.")
            return jsonify({
                'success': True,
                'message': f'Products imported successfully! New: {imported_count}, Updated: {updated_count}.',
                'errors': errors
            }), 200

        except Exception as e:
            os.remove(filepath)
            app.logger.error(f"Error processing CSV file '{filename}': {e}")
            return jsonify({'success': False, 'message': f'Error processing CSV file: {e}'}), 500
    else:
        app.logger.warning(f"Invalid file type uploaded: {file.filename}")
        return jsonify({'success': False, 'message': 'Allowed file types are CSV.'}), 400

# --- NEW API ENDPOINTS FOR GOOGLE SHEETS MANAGEMENT ---

@app.route('/api/admin/sheets/products', methods=['GET'])
# Removed @admin_required to allow public access for products.html
def api_admin_sheets_get_products():
    """Retrieves all products from the Google Sheet."""
    products = get_all_sheet_products()
    if products is not None:
        # Add a basic search/filter for the products from Google Sheet
        query = request.args.get('query', '').lower()
        if query:
            products = [
                p for p in products 
                if query in p.get('name', '').lower() or query in p.get('description', '').lower()
            ]
        return jsonify({'success': True, 'products': products}), 200
    return jsonify({'success': False, 'message': 'Failed to retrieve products from Google Sheet.'}), 500

@app.route('/api/admin/sheets/products', methods=['POST'])
@admin_required
def api_admin_sheets_add_product():
    """Adds a new product to the Google Sheet."""
    product_data = {
        'name': request.form.get('name'),
        'description': request.form.get('description'),
        'price': float(request.form.get('price')),
        'image_url': request.form.get('image_url'),
        'stock': int(request.form.get('stock'))
    }
    if add_sheet_product(product_data):
        return jsonify({'success': True, 'message': 'Product added to Google Sheet.'}), 201
    return jsonify({'success': False, 'message': 'Failed to add product to Google Sheet.'}), 500

@app.route('/api/admin/sheets/products/<int:product_id>', methods=['PUT'])
@admin_required
def api_admin_sheets_update_product(product_id):
    """Updates an existing product in the Google Sheet."""
    product_data = {
        'name': request.form.get('name'),
        'description': request.form.get('description'),
        'price': float(request.form.get('price')),
        'image_url': request.form.get('image_url'),
        'stock': int(request.form.get('stock'))
    }
    # Filter out None values if fields are optional in the form
    product_data = {k: v for k, v in product_data.items() if v is not None}

    if update_sheet_product(product_id, product_data):
        return jsonify({'success': True, 'message': f'Product {product_id} updated in Google Sheet.'}), 200
    return jsonify({'success': False, 'message': f'Failed to update product {product_id} in Google Sheet.'}), 500

@app.route('/api/admin/sheets/products/<int:product_id>', methods=['DELETE'])
@admin_required
def api_admin_sheets_delete_product(product_id):
    """Deletes a product from the Google Sheet."""
    if delete_sheet_product(product_id):
        return jsonify({'success': True, 'message': f'Product {product_id} deleted from Google Sheet.'}), 200
    return jsonify({'success': False, 'message': f'Failed to delete product {product_id} from Google Sheet.'}), 500

@app.route('/api/admin/sheets/orders', methods=['GET'])
@admin_required
def api_admin_sheets_get_orders():
    """Retrieves all orders from the Google Sheet."""
    orders = get_all_sheet_orders()
    if orders is not None:
        return jsonify({'success': True, 'orders': orders}), 200
    return jsonify({'success': False, 'message': 'Failed to retrieve orders from Google Sheet.'}), 500

@app.route('/api/admin/sheets/orders/<int:order_id>/status', methods=['PUT'])
@admin_required
def api_admin_sheets_update_order_status(order_id):
    """Updates the status of an order in the Google Sheet."""
    new_status = request.form.get('status')
    if not new_status:
        return jsonify({'success': False, 'message': 'New status is required.'}), 400
    
    allowed_statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    if new_status not in allowed_statuses:
        return jsonify({'success': False, 'message': 'Invalid status provided.'}), 400

    if update_sheet_order_status(order_id, new_status):
        return jsonify({'success': True, 'message': f'Order {order_id} status updated to {new_status} in Google Sheet.'}), 200
    return jsonify({'success': False, 'message': f'Failed to update order {order_id} status in Google Sheet.'}), 500


if __name__ == '__main__':
    db_path = app.config['DATABASE']
    if not os.path.exists(db_path):
        app.logger.info(f"Database file '{db_path}' not found. Initializing database...")
        with app.app_context():
            init_db()
    else:
        app.logger.info(f"Database file '{db_path}' found. Skipping initialization.")

    app.run(debug=True)
