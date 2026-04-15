"""Rotas da API para comprovantes de prestação de contas (/api/receipts)."""

import os
import uuid

from flask import Blueprint, current_app, jsonify, request, url_for
from werkzeug.utils import secure_filename

from backend.app import db
from backend.models import Receipt

receipts_bp = Blueprint('receipts', __name__)


def _build_image_url(image_path):
    if not image_path:
        return None
    try:
        return url_for('serve_upload', filename=image_path, _external=True)
    except RuntimeError:
        return '/uploads/' + image_path


@receipts_bp.route('/api/receipts', methods=['POST'])
def create_receipt():
    """Recebe comprovante via multipart/form-data e salva no banco."""
    try:
        volunteer_name = request.form.get('volunteer_name')
        owner_key = request.form.get('owner_key')
        title = request.form.get('title')
        if not title:
            return jsonify({"error": "title é obrigatório"}), 400

        description = request.form.get('description')

        # Handle image upload
        image_path = None
        if 'image' in request.files:
            image = request.files['image']
            if image.filename:
                ext = os.path.splitext(image.filename)[1] or '.jpg'
                filename = secure_filename(f"{uuid.uuid4().hex}{ext}")
                uploads_dir = current_app.config['UPLOADS_DIR']
                os.makedirs(uploads_dir, exist_ok=True)
                image.save(os.path.join(uploads_dir, filename))
                image_path = filename

        receipt_id = request.form.get('id') or str(uuid.uuid4())

        receipt = Receipt(
            id=receipt_id,
            volunteer_name=volunteer_name,
            owner_key=owner_key,
            title=title,
            description=description,
            image_path=image_path,
        )

        db.session.add(receipt)
        db.session.commit()

        return jsonify({
            "id": receipt.id,
            "volunteer_name": receipt.volunteer_name,
            "owner_key": receipt.owner_key,
            "title": receipt.title,
            "description": receipt.description,
            "image_path": receipt.image_path,
            "image_url": _build_image_url(receipt.image_path),
            "created_at": receipt.created_at.isoformat() if receipt.created_at else None,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@receipts_bp.route('/api/receipts', methods=['GET'])
def list_receipts():
    """Lista todos os comprovantes ordenados por created_at decrescente."""
    try:
        volunteer_name = request.args.get('volunteer_name', '').strip()
        owner_key = request.args.get('owner_key', '').strip()

        query = Receipt.query
        if owner_key:
            query = query.filter(Receipt.owner_key == owner_key)
        elif volunteer_name:
            query = query.filter(Receipt.volunteer_name == volunteer_name)
        else:
            return jsonify([]), 200

        receipts = query.order_by(Receipt.created_at.desc()).all()
        result = []
        for r in receipts:
            result.append({
                "id": r.id,
                "volunteer_name": r.volunteer_name,
                "owner_key": r.owner_key,
                "title": r.title,
                "description": r.description,
                "image_path": r.image_path,
                "image_url": _build_image_url(r.image_path),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
