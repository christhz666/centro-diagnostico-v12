/**
 * Servicio de caché con Redis para thumbnails DICOM
 * Fallback a Map() si Redis no está disponible
 */

const NodeCache = require('node-cache');

// Usar node-cache como alternativa ligera a Redis
// En producción con múltiples instancias, migrar a Redis
const cache = new NodeCache({ 
    stdTTL: 3600, // 1 hora por defecto
    checkperiod: 600, // Limpiar expirados cada 10 min
    maxKeys: 1000 // Máximo 1000 thumbnails en caché
});

const THUMBNAIL_PREFIX = 'dicom:thumb:';
const METADATA_PREFIX = 'dicom:meta:';

class DicomCache {
    /**
     * Guardar thumbnail en caché
     * @param {string} imageId - ID único de la imagen
     * @param {Buffer} thumbnail - Buffer de la imagen thumbnail
     * @param {Object} metadata - Metadatos asociados
     */
    static setThumbnail(imageId, thumbnail, metadata = {}) {
        const key = THUMBNAIL_PREFIX + imageId;
        const metaKey = METADATA_PREFIX + imageId;
        
        try {
            cache.set(key, thumbnail, 3600); // 1 hora TTL
            cache.set(metaKey, metadata, 3600);
            return true;
        } catch (error) {
            console.error('[DicomCache] Error guardando thumbnail:', error.message);
            return false;
        }
    }

    /**
     * Obtener thumbnail de caché
     * @param {string} imageId - ID único de la imagen
     * @returns {Object|null} - { thumbnail, metadata } o null si no existe
     */
    static getThumbnail(imageId) {
        const key = THUMBNAIL_PREFIX + imageId;
        const metaKey = METADATA_PREFIX + imageId;
        
        const thumbnail = cache.get(key);
        const metadata = cache.get(metaKey);
        
        if (!thumbnail) return null;
        
        return { thumbnail, metadata: metadata || {} };
    }

    /**
     * Verificar si existe thumbnail en caché
     * @param {string} imageId - ID único de la imagen
     */
    static hasThumbnail(imageId) {
        const key = THUMBNAIL_PREFIX + imageId;
        return cache.has(key);
    }

    /**
     * Invalidar thumbnail específico
     * @param {string} imageId - ID único de la imagen
     */
    static invalidate(imageId) {
        const key = THUMBNAIL_PREFIX + imageId;
        const metaKey = METADATA_PREFIX + imageId;
        
        cache.del(key);
        cache.del(metaKey);
    }

    /**
     * Limpiar toda la caché de thumbnails
     */
    static clearAll() {
        const keys = cache.keys();
        const dicomKeys = keys.filter(k => k.startsWith(THUMBNAIL_PREFIX) || k.startsWith(METADATA_PREFIX));
        cache.del(dicomKeys);
        console.log(`[DicomCache] Limpiados ${dicomKeys.length / 2} thumbnails`);
    }

    /**
     * Obtener estadísticas de la caché
     */
    static getStats() {
        const keys = cache.keys();
        const thumbCount = keys.filter(k => k.startsWith(THUMBNAIL_PREFIX)).length;
        
        return {
            thumbnails: thumbCount,
            totalKeys: keys.length,
            hitRate: cache.getStats().hits / (cache.getStats().hits + cache.getStats().misses) || 0
        };
    }
}

module.exports = DicomCache;
