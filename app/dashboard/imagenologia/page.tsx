'use client'

import { useState } from 'react'
import { FaSearch, FaImage, FaExpand, FaDownload, FaSun, FaAdjust, FaSearchPlus, FaSearchMinus, FaUndo, FaRedo } from 'react-icons/fa'

const IMAGENES = [
  { id: '1', paciente: 'Juan Carlos Mendez', estudio: 'Radiografia de Torax', fecha: '2024-01-15', thumbnail: '/placeholder-xray-1.jpg' },
  { id: '2', paciente: 'Maria Elena Rodriguez', estudio: 'Ecografia Abdominal', fecha: '2024-01-15', thumbnail: '/placeholder-eco-1.jpg' },
  { id: '3', paciente: 'Carlos Alberto Perez', estudio: 'Radiografia de Torax', fecha: '2024-01-14', thumbnail: '/placeholder-xray-2.jpg' },
  { id: '4', paciente: 'Ana Sofia Martinez', estudio: 'Tomografia Craneal', fecha: '2024-01-14', thumbnail: '/placeholder-ct-1.jpg' },
]

export default function ImagenologiaPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedImage, setSelectedImage] = useState<typeof IMAGENES[0] | null>(null)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)

  const filteredImagenes = IMAGENES.filter(img =>
    img.paciente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    img.estudio.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const resetViewer = () => {
    setZoom(100)
    setRotation(0)
    setBrightness(100)
    setContrast(100)
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="bg-white dark:bg-card-dark rounded-xl p-5 border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="relative max-w-xl">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por paciente o estudio..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#1c2029] border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredImagenes.map(imagen => (
          <div
            key={imagen.id}
            className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedImage(imagen)}
          >
            <div className="aspect-square bg-slate-900 relative flex items-center justify-center">
              <FaImage className="text-6xl text-slate-700" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <FaExpand className="text-white text-2xl" />
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-slate-800 dark:text-white text-sm truncate">{imagen.estudio}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{imagen.paciente}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{imagen.fecha}</p>
            </div>
          </div>
        ))}
      </div>

      {filteredImagenes.length === 0 && (
        <div className="bg-white dark:bg-card-dark rounded-xl p-12 border border-slate-200 dark:border-white/5 shadow-sm text-center">
          <FaImage className="text-5xl text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">No hay imagenes</h3>
          <p className="text-slate-500 dark:text-slate-400">
            No se encontraron imagenes que coincidan con tu busqueda
          </p>
        </div>
      )}

      {/* Image viewer modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
            <div>
              <h3 className="font-semibold text-white">{selectedImage.estudio}</h3>
              <p className="text-sm text-slate-400">{selectedImage.paciente}</p>
            </div>
            <button
              onClick={() => { setSelectedImage(null); resetViewer(); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>

          {/* Viewer */}
          <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
            <div
              className="w-96 h-96 bg-slate-900 rounded-lg flex items-center justify-center transition-transform duration-200"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                filter: `brightness(${brightness}%) contrast(${contrast}%)`
              }}
            >
              <FaImage className="text-9xl text-slate-700" />
            </div>
          </div>

          {/* Controls */}
          <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-6 px-4">
            {/* Zoom */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(25, zoom - 25))}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <FaSearchMinus />
              </button>
              <span className="text-white w-16 text-center text-sm">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(400, zoom + 25))}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <FaSearchPlus />
              </button>
            </div>

            <div className="w-px h-8 bg-slate-700" />

            {/* Rotation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRotation(rotation - 90)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <FaUndo />
              </button>
              <button
                onClick={() => setRotation(rotation + 90)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <FaRedo />
              </button>
            </div>

            <div className="w-px h-8 bg-slate-700" />

            {/* Brightness */}
            <div className="flex items-center gap-2">
              <FaSun className="text-slate-400" />
              <input
                type="range"
                min="50"
                max="150"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-24 accent-cyan-500"
              />
            </div>

            {/* Contrast */}
            <div className="flex items-center gap-2">
              <FaAdjust className="text-slate-400" />
              <input
                type="range"
                min="50"
                max="150"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-24 accent-cyan-500"
              />
            </div>

            <div className="w-px h-8 bg-slate-700" />

            {/* Actions */}
            <button
              onClick={resetViewer}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
            >
              Reiniciar
            </button>
            <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors text-sm flex items-center gap-2">
              <FaDownload />
              Descargar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
