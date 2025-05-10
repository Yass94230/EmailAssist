// Mise à jour du composant de chargement
{isLoading && (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <Spinner size="lg" className="text-green-500" />
  </div>
)}