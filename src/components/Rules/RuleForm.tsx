import React, { useState } from 'react';
import { X } from 'lucide-react';
import { EmailRule } from '../../types';
import { createRule, updateRule } from '../../services/supabase';

interface RuleFormProps {
  onSubmit: (rule: EmailRule) => void;
  onCancel: () => void;
  initialRule?: EmailRule;
}

const RuleForm: React.FC<RuleFormProps> = ({ onSubmit, onCancel, initialRule }) => {
  const [rule, setRule] = useState<Omit<EmailRule, 'id'>>(
    initialRule || {
      name: '',
      condition: '',
      action: 'markAsImportant',
      isActive: true,
      parameters: {}
    }
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!rule.name.trim()) {
        throw new Error('Le nom de la règle est requis');
      }

      if (!rule.condition.trim()) {
        throw new Error('La condition est requise');
      }

      if (rule.action === 'moveToFolder' && !rule.parameters?.folderName?.trim()) {
        throw new Error('Le nom du dossier est requis');
      }

      let savedRule: EmailRule;
      
      if (initialRule) {
        await updateRule({ ...rule, id: initialRule.id });
        savedRule = { ...rule, id: initialRule.id };
      } else {
        savedRule = await createRule(rule);
      }

      onSubmit(savedRule);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de la règle:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde de la règle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {initialRule ? 'Modifier la règle' : 'Nouvelle règle'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de la règle
            </label>
            <input
              type="text"
              value={rule.name}
              onChange={e => setRule({ ...rule, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ex: Marquer les emails importants"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action
            </label>
            <select
              value={rule.action}
              onChange={e => setRule({ ...rule, action: e.target.value as EmailRule['action'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="markAsImportant">Marquer comme important</option>
              <option value="moveToFolder">Déplacer vers un dossier</option>
              <option value="markAsRead">Marquer comme lu</option>
            </select>
          </div>

          {rule.action === 'moveToFolder' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dossier de destination
              </label>
              <input
                type="text"
                value={rule.parameters?.folderName || ''}
                onChange={e => setRule({
                  ...rule,
                  parameters: { ...rule.parameters, folderName: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: Social"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Condition
            </label>
            <textarea
              value={rule.condition}
              onChange={e => setRule({ ...rule, condition: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ex: senderEmail.includes('linkedin.com')"
              rows={3}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Utilisez des conditions comme sender, subject, senderEmail, isRead, hasAttachments
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors disabled:bg-green-300"
              disabled={loading}
            >
              {loading ? 'Enregistrement...' : (initialRule ? 'Mettre à jour' : 'Créer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RuleForm;