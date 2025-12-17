#!/usr/bin/env python
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'phone_shop_system'))
os.chdir(os.path.join(os.path.dirname(__file__), 'phone_shop_system'))
from main import app

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
