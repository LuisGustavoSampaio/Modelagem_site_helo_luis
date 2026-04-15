import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Paths
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))


def _resolve_data_dir():
    """Resolve the directory used for persistent runtime data."""
    configured = os.environ.get('ARIRI_DATA_DIR')
    if configured:
        return os.path.abspath(configured)
    return BASE_DIR


def _resolve_database_uri(data_dir):
    """Build the SQLAlchemy URI, preferring an explicit env override."""
    configured = os.environ.get('DATABASE_URL')
    if configured:
        if configured.startswith('postgres://'):
            configured = 'postgresql://' + configured[len('postgres://'):]
        return configured
    return 'sqlite:///' + os.path.join(data_dir, 'ariri.db')


def _resolve_uploads_dir(data_dir):
    """Resolve the uploads directory, allowing a dedicated persistent mount."""
    configured = os.environ.get('ARIRI_UPLOADS_DIR')
    if configured:
        return os.path.abspath(configured)
    return os.path.join(data_dir, 'uploads')


def create_app():
    """Create and configure the Flask application."""
    data_dir = _resolve_data_dir()
    uploads_dir = _resolve_uploads_dir(data_dir)

    app = Flask(
        __name__,
        static_folder=None  # Disable default static handler; we serve manually.
    )

    os.makedirs(data_dir, exist_ok=True)

    # Prefer DATABASE_URL when present; otherwise keep SQLite with a configurable data dir.
    app.config['SQLALCHEMY_DATABASE_URI'] = _resolve_database_uri(data_dir)
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOADS_DIR'] = uploads_dir

    # PIN for protected sections.
    app.config['ACCESS_PIN'] = os.environ.get('ARIRI_PIN', '1234')

    db.init_app(app)
    CORS(app)

    os.makedirs(uploads_dir, exist_ok=True)

    _register_blueprints(app)

    with app.app_context():
        try:
            from . import models  # noqa: F401
        except ImportError:
            pass
        db.create_all()

    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(uploads_dir, filename)

    @app.route('/')
    def serve_index():
        return send_from_directory(FRONTEND_DIR, 'index.html')

    @app.route('/<path:path>')
    def catch_all(path):
        file_path = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(file_path):
            return send_from_directory(FRONTEND_DIR, path)
        return send_from_directory(FRONTEND_DIR, 'index.html')

    return app


def _register_blueprints(app):
    """Register route blueprints. Skips any that aren't implemented yet."""
    blueprint_imports = [
        ('routes.ping', 'ping_bp'),
        ('routes.pin', 'pin_bp'),
        ('routes.forms', 'forms_bp'),
        ('routes.posts', 'posts_bp'),
        ('routes.receipts', 'receipts_bp'),
        ('routes.volunteers', 'volunteers_bp'),
        ('routes.schedule', 'schedule_bp'),
        ('routes.sync', 'sync_bp'),
    ]
    for module_path, bp_name in blueprint_imports:
        try:
            module = __import__(f'backend.{module_path}', fromlist=[bp_name])
            bp = getattr(module, bp_name)
            app.register_blueprint(bp)
        except (ImportError, AttributeError):
            pass


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
