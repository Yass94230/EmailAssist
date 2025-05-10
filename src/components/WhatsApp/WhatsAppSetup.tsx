// Mise à jour de l'indicateur de chargement
{isProcessing && (
  <div className="flex items-center justify-center gap-2">
    <Spinner size="sm" className="text-blue-500" />
    <span className="text-blue-600">Traitement en cours...</span>
  </div>
)}