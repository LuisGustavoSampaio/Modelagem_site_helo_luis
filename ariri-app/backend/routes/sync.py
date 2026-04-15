"""Rota da API para sincronizacao em lote (/api/sync)."""

import base64
import json
import os
import uuid
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

from backend.app import db
from backend.models import Form, Post, Receipt

sync_bp = Blueprint('sync', __name__)


def _save_base64_image(base64_data):
    """Decodifica imagem base64 e salva em uploads/. Retorna o filename."""
    if not base64_data:
        return None

    if ',' in base64_data:
        base64_data = base64_data.split(',', 1)[1]

    try:
        image_bytes = base64.b64decode(base64_data)
    except Exception:
        return None

    filename = f"{uuid.uuid4().hex}.jpg"
    uploads_dir = current_app.config['UPLOADS_DIR']
    os.makedirs(uploads_dir, exist_ok=True)
    with open(os.path.join(uploads_dir, filename), 'wb') as f:
        f.write(image_bytes)

    return filename


def _parse_created_at(value):
    """Parse ISO 8601 created_at string into a datetime object."""
    if not value:
        return datetime.utcnow()
    try:
        if isinstance(value, str) and value.endswith('Z'):
            value = value[:-1] + '+00:00'
        return datetime.fromisoformat(value).replace(tzinfo=None)
    except (ValueError, TypeError):
        return datetime.utcnow()


def _parse_actions(raw_actions):
    if raw_actions is None:
        raise ValueError("Campo 'actions' e obrigatorio")

    actions = raw_actions
    if isinstance(actions, str):
        try:
            actions = json.loads(actions)
        except (json.JSONDecodeError, TypeError):
            actions = [actions] if actions else []

    if not isinstance(actions, list):
        actions = [actions]

    normalized = [str(action).strip() for action in actions if str(action).strip()]
    if not normalized:
        raise ValueError("Ao menos uma acao deve ser selecionada")
    return normalized


def _parse_people_served(raw_value):
    if raw_value is None or raw_value == '':
        return 1
    try:
        value = int(raw_value)
    except (ValueError, TypeError):
        raise ValueError("Campo 'people_served' deve ser um inteiro")
    if value < 1:
        raise ValueError("Campo 'people_served' deve ser maior que zero")
    return value


def _parse_age(raw_value):
    if raw_value is None or raw_value == '':
        return None
    try:
        return int(raw_value)
    except (ValueError, TypeError):
        raise ValueError("Campo 'age' deve ser um inteiro")


def _sync_form(item_id, data, created_at):
    volunteer_name = str(data.get('volunteer_name', '')).strip()
    if not volunteer_name:
        raise ValueError("Campo 'volunteer_name' e obrigatorio")

    actions = _parse_actions(data.get('actions'))
    image_path = _save_base64_image(data.get('image'))

    form = Form(
        id=item_id,
        volunteer_name=volunteer_name,
        actions=actions,
        full_name=data.get('full_name'),
        age=_parse_age(data.get('age')),
        locality=data.get('locality'),
        description=data.get('description'),
        image_path=image_path,
        people_served=_parse_people_served(data.get('people_served')),
        created_at=created_at,
    )
    db.session.add(form)


def _sync_post(item_id, data, created_at):
    volunteer_name = str(data.get('volunteer_name', '')).strip()
    title = str(data.get('title', '')).strip()

    if not volunteer_name:
        raise ValueError("Campo 'volunteer_name' e obrigatorio")
    if not title:
        raise ValueError("Campo 'title' e obrigatorio")

    image_path = _save_base64_image(data.get('image'))

    post = Post(
        id=item_id,
        volunteer_name=volunteer_name,
        title=title,
        description=data.get('description'),
        image_path=image_path,
        created_at=created_at,
    )
    db.session.add(post)


def _sync_receipt(item_id, data, created_at):
    title = str(data.get('title', '')).strip()
    if not title:
        raise ValueError("Campo 'title' e obrigatorio")

    image_path = _save_base64_image(data.get('image'))

    receipt = Receipt(
        id=item_id,
        title=title,
        description=data.get('description'),
        image_path=image_path,
        created_at=created_at,
    )
    db.session.add(receipt)


_TYPE_HANDLERS = {
    'form': (_sync_form, Form),
    'post': (_sync_post, Post),
    'receipt': (_sync_receipt, Receipt),
}


@sync_bp.route('/api/sync', methods=['POST'])
def batch_sync():
    """Recebe array de itens e sincroniza em lote."""
    try:
        body = request.get_json(silent=True)
        if not body or 'items' not in body:
            return jsonify({"error": "Campo 'items' e obrigatorio"}), 400

        items = body['items']
        if not isinstance(items, list):
            return jsonify({"error": "'items' deve ser uma lista"}), 400

        synced = []
        errors = []

        for item in items:
            item_id = item.get('id')
            item_type = item.get('type')
            data = item.get('data', {})
            created_at_raw = item.get('created_at')

            if not item_id:
                errors.append({"id": item_id, "error": "Campo 'id' e obrigatorio"})
                continue

            if item_type not in _TYPE_HANDLERS:
                errors.append({"id": item_id, "error": f"Tipo '{item_type}' nao suportado"})
                continue

            handler, model = _TYPE_HANDLERS[item_type]
            existing = db.session.get(model, item_id)
            if existing:
                synced.append(item_id)
                continue

            created_at = _parse_created_at(created_at_raw)

            try:
                handler(item_id, data, created_at)
                db.session.commit()
                synced.append(item_id)
            except Exception as e:
                db.session.rollback()
                errors.append({"id": item_id, "error": str(e)})

        return jsonify({"synced": synced, "errors": errors}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
