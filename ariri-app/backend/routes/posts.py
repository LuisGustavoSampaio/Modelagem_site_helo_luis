"""Rotas da API para postagens do Diário de Bordo (/api/posts)."""

import os
import uuid

from flask import Blueprint, current_app, jsonify, request, url_for
from werkzeug.utils import secure_filename

from backend.app import db
from backend.models import Post

posts_bp = Blueprint('posts', __name__)


def _normalize_name(value):
    return ' '.join(str(value or '').strip().lower().split())


def _build_image_url(image_path):
    if not image_path:
        return None
    try:
        return url_for('serve_upload', filename=image_path, _external=True)
    except RuntimeError:
        return '/uploads/' + image_path


@posts_bp.route('/api/posts', methods=['POST'])
def create_post():
    """Recebe postagem via multipart/form-data e salva no banco."""
    try:
        volunteer_name = request.form.get('volunteer_name')
        if not volunteer_name:
            return jsonify({"error": "volunteer_name é obrigatório"}), 400

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

        post_id = request.form.get('id') or str(uuid.uuid4())

        post = Post(
            id=post_id,
            volunteer_name=volunteer_name,
            owner_key=request.form.get('owner_key') or None,
            title=title,
            description=description,
            image_path=image_path,
        )

        db.session.add(post)
        db.session.commit()

        return jsonify({
            "id": post.id,
            "volunteer_name": post.volunteer_name,
            "owner_key": post.owner_key,
            "title": post.title,
            "description": post.description,
            "image_path": post.image_path,
            "image_url": _build_image_url(post.image_path),
            "created_at": post.created_at.isoformat() if post.created_at else None,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@posts_bp.route('/api/posts', methods=['GET'])
def list_posts():
    """Lista todas as postagens ordenadas por created_at decrescente."""
    try:
        posts = Post.query.order_by(Post.created_at.desc()).all()
        result = []
        for p in posts:
            result.append({
                "id": p.id,
                "volunteer_name": p.volunteer_name,
                "owner_key": p.owner_key,
                "title": p.title,
                "description": p.description,
                "image_path": p.image_path,
                "image_url": _build_image_url(p.image_path),
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _delete_post_impl(post_id):
    """Exclui uma postagem apenas se o nome informado corresponder ao autor."""
    try:
        body = request.get_json(silent=True) or {}
        volunteer_name = str(body.get('volunteer_name', '')).strip()
        owner_key = str(body.get('owner_key', '')).strip()
        pin = str(body.get('pin', '')).strip()
        if not volunteer_name:
            return jsonify({"error": "volunteer_name e obrigatorio"}), 400

        post = db.session.get(Post, post_id)
        if not post:
            return jsonify({"error": "Postagem nao encontrada"}), 404

        if post.owner_key:
            if not owner_key or post.owner_key != owner_key:
                same_name = _normalize_name(post.volunteer_name) == _normalize_name(volunteer_name)
                valid_pin = pin and pin == current_app.config.get('ACCESS_PIN', '')
                if not (same_name and valid_pin):
                    return jsonify({"error": "Voce nao pode excluir a postagem de outra pessoa"}), 403
        elif _normalize_name(post.volunteer_name) != _normalize_name(volunteer_name):
            return jsonify({"error": "Voce nao pode excluir a postagem de outra pessoa"}), 403

        image_path = post.image_path
        db.session.delete(post)
        db.session.commit()

        if image_path:
            uploads_dir = current_app.config['UPLOADS_DIR']
            image_file = os.path.join(uploads_dir, image_path)
            if os.path.isfile(image_file):
                try:
                    os.remove(image_file)
                except OSError:
                    pass

        return jsonify({"status": "ok", "deleted_id": post_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@posts_bp.route('/api/posts/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    return _delete_post_impl(post_id)


@posts_bp.route('/api/posts/<post_id>/delete', methods=['POST'])
def delete_post_via_post(post_id):
    return _delete_post_impl(post_id)
