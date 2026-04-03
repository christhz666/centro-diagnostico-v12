// Archivo de inicialización opcional para MongoDB en Docker.
// Se mantiene intencionalmente liviano para evitar acoplar lógica de negocio
// al arranque del contenedor.

// `db` es inyectado automáticamente por el runtime de Mongo durante init.
db.createCollection('docker_init_marker');
