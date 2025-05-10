import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { EmailRule } from '../../types';
import { getRules, updateRule, deleteRule } from '../../services/supabase';

interface RulesListProps {
  onAddRule?: () => void;
}

const RulesList: React.FC<RulesListProps> = ({ onAddRule }) => {
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const fetchedRules = await getRules();
      setRules(fetchedRules);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des règles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    try {
      const updatedRule = { ...rule, isActive: !rule.isActive };
      await updateRule(updatedRule);
      setRules(prevRules =>
        prevRules.map(r =>
          r.id === ruleId ? updatedRule : r
        )
      );
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la règle:', err);
      setError('Erreur lors de la mise à jour de la règle');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) return;

    try {
      await deleteRule(ruleId);
      setRules(prevRules => prevRules.filter(rule => rule.id !== ruleId));
      setError(null);
    } catch (err) {
      console.error('Erreur lors de la suppression de la règle:', err);
      setError('Erreur lors de la suppression de la règle');
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Chargement des règles...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">
          {rules.length} règle{rules.length !== 1 ? 's' : ''} active{rules.length !== 1 ? 's' : ''}
        </h3>
        <button
          onClick={onAddRule}
          className="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle règle
        </button>
      </div>

      <div className="space-y-2">
        {rules.length === 0 ? (
          <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
            Aucune règle définie. Créez votre première règle !
          </div>
        ) : (
          rules.map(rule => (
            <div key={rule.id} className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">{rule.name}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {rule.action === 'markAsImportant' && "Marquer comme important"}
                    {rule.action === 'moveToFolder' && `Déplacer vers ${rule.parameters?.folderName}`}
                    {rule.action === 'markAsRead' && "Marquer comme lu"}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`p-2 rounded-full transition-colors ${
                      rule.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {rule.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 text-red-400 hover:text-red-500 rounded-full hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RulesList;