import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({
    open,
    title = "¿Estás segura?",
    message,
    confirmText = "Sí, continuar",
    cancelText = "Cancelar",
    confirmColor = "#dc2626",   // rojo por defecto (acción destructiva)
    onConfirm,
    onCancel,
}) => {
    if (!open) return null;

    return (
        <div className="confirm-overlay" onClick={onCancel}>
            <div
                className="confirm-paper font-handwritten"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cinta adhesiva decorativa */}
                <div className="confirm-tape" />

                <h3 className="confirm-title">{title}</h3>
                <p className="confirm-message">{message}</p>

                <div className="confirm-actions">
                    <button
                        type="button"
                        className="confirm-btn confirm-btn-cancel"
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className="confirm-btn confirm-btn-ok"
                        style={{ borderColor: confirmColor, color: confirmColor }}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;