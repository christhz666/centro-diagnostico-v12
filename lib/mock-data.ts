// Datos de prueba para el sistema

export interface Paciente {
  id: string
  nombre: string
  cedula: string
  telefono: string
  email: string
  fechaNacimiento: string
  direccion: string
  sexo: 'M' | 'F'
}

export interface Estudio {
  id: string
  nombre: string
  codigo: string
  precio: number
  categoria: string
}

export interface Cita {
  id: string
  pacienteId: string
  pacienteNombre: string
  estudios: string[]
  fecha: string
  hora: string
  estado: 'pendiente' | 'en_proceso' | 'completado' | 'cancelado'
  total: number
}

export interface Resultado {
  id: string
  pacienteId: string
  pacienteNombre: string
  estudio: string
  fecha: string
  estado: 'pendiente' | 'validado'
  medicoValidador?: string
}

// Pacientes de prueba
export const PACIENTES: Paciente[] = [
  { id: '1', nombre: 'Juan Carlos Mendez', cedula: 'V-12345678', telefono: '0414-1234567', email: 'juan@email.com', fechaNacimiento: '1985-05-15', direccion: 'Av. Principal, Caracas', sexo: 'M' },
  { id: '2', nombre: 'Maria Elena Rodriguez', cedula: 'V-23456789', telefono: '0424-2345678', email: 'maria@email.com', fechaNacimiento: '1990-08-22', direccion: 'Calle 5, Valencia', sexo: 'F' },
  { id: '3', nombre: 'Carlos Alberto Perez', cedula: 'V-34567890', telefono: '0412-3456789', email: 'carlos@email.com', fechaNacimiento: '1978-12-03', direccion: 'Urb. Las Mercedes, Maracaibo', sexo: 'M' },
  { id: '4', nombre: 'Ana Sofia Martinez', cedula: 'V-45678901', telefono: '0416-4567890', email: 'ana@email.com', fechaNacimiento: '1995-03-28', direccion: 'Sector Centro, Barquisimeto', sexo: 'F' },
  { id: '5', nombre: 'Pedro Jose Gonzalez', cedula: 'V-56789012', telefono: '0426-5678901', email: 'pedro@email.com', fechaNacimiento: '1982-07-10', direccion: 'Av. Bolivar, Merida', sexo: 'M' },
  { id: '6', nombre: 'Laura Patricia Diaz', cedula: 'V-67890123', telefono: '0414-6789012', email: 'laura@email.com', fechaNacimiento: '1988-11-18', direccion: 'Calle Principal, Puerto La Cruz', sexo: 'F' },
  { id: '7', nombre: 'Roberto Miguel Silva', cedula: 'V-78901234', telefono: '0424-7890123', email: 'roberto@email.com', fechaNacimiento: '1975-04-25', direccion: 'Urb. El Paraiso, Caracas', sexo: 'M' },
  { id: '8', nombre: 'Carmen Rosa Lopez', cedula: 'V-89012345', telefono: '0412-8901234', email: 'carmen@email.com', fechaNacimiento: '1992-09-07', direccion: 'Sector La Florida, Valencia', sexo: 'F' },
]

// Estudios disponibles
export const ESTUDIOS: Estudio[] = [
  { id: '1', nombre: 'Hematologia Completa', codigo: 'HEM-001', precio: 25.00, categoria: 'Hematologia' },
  { id: '2', nombre: 'Perfil Lipidico', codigo: 'BIO-001', precio: 35.00, categoria: 'Bioquimica' },
  { id: '3', nombre: 'Glicemia', codigo: 'BIO-002', precio: 12.00, categoria: 'Bioquimica' },
  { id: '4', nombre: 'Urea y Creatinina', codigo: 'BIO-003', precio: 20.00, categoria: 'Bioquimica' },
  { id: '5', nombre: 'Perfil Hepatico', codigo: 'BIO-004', precio: 45.00, categoria: 'Bioquimica' },
  { id: '6', nombre: 'Examen de Orina', codigo: 'URO-001', precio: 15.00, categoria: 'Urologia' },
  { id: '7', nombre: 'Perfil Tiroideo', codigo: 'HOR-001', precio: 55.00, categoria: 'Hormonas' },
  { id: '8', nombre: 'TSH', codigo: 'HOR-002', precio: 25.00, categoria: 'Hormonas' },
  { id: '9', nombre: 'Hemoglobina Glicosilada', codigo: 'BIO-005', precio: 30.00, categoria: 'Bioquimica' },
  { id: '10', nombre: 'Radiografia de Torax', codigo: 'IMG-001', precio: 40.00, categoria: 'Imagenologia' },
  { id: '11', nombre: 'Ecografia Abdominal', codigo: 'IMG-002', precio: 60.00, categoria: 'Imagenologia' },
  { id: '12', nombre: 'Electrocardiograma', codigo: 'CAR-001', precio: 35.00, categoria: 'Cardiologia' },
]

// Citas del dia
export const CITAS: Cita[] = [
  { id: '1', pacienteId: '1', pacienteNombre: 'Juan Carlos Mendez', estudios: ['Hematologia Completa', 'Glicemia'], fecha: new Date().toISOString().split('T')[0], hora: '08:00', estado: 'completado', total: 37.00 },
  { id: '2', pacienteId: '2', pacienteNombre: 'Maria Elena Rodriguez', estudios: ['Perfil Lipidico'], fecha: new Date().toISOString().split('T')[0], hora: '08:30', estado: 'completado', total: 35.00 },
  { id: '3', pacienteId: '3', pacienteNombre: 'Carlos Alberto Perez', estudios: ['Perfil Hepatico', 'Urea y Creatinina'], fecha: new Date().toISOString().split('T')[0], hora: '09:00', estado: 'en_proceso', total: 65.00 },
  { id: '4', pacienteId: '4', pacienteNombre: 'Ana Sofia Martinez', estudios: ['Perfil Tiroideo'], fecha: new Date().toISOString().split('T')[0], hora: '09:30', estado: 'en_proceso', total: 55.00 },
  { id: '5', pacienteId: '5', pacienteNombre: 'Pedro Jose Gonzalez', estudios: ['Hematologia Completa', 'Examen de Orina'], fecha: new Date().toISOString().split('T')[0], hora: '10:00', estado: 'pendiente', total: 40.00 },
  { id: '6', pacienteId: '6', pacienteNombre: 'Laura Patricia Diaz', estudios: ['Ecografia Abdominal'], fecha: new Date().toISOString().split('T')[0], hora: '10:30', estado: 'pendiente', total: 60.00 },
  { id: '7', pacienteId: '7', pacienteNombre: 'Roberto Miguel Silva', estudios: ['Electrocardiograma', 'Radiografia de Torax'], fecha: new Date().toISOString().split('T')[0], hora: '11:00', estado: 'pendiente', total: 75.00 },
  { id: '8', pacienteId: '8', pacienteNombre: 'Carmen Rosa Lopez', estudios: ['Hemoglobina Glicosilada', 'Glicemia'], fecha: new Date().toISOString().split('T')[0], hora: '11:30', estado: 'pendiente', total: 42.00 },
]

// Resultados pendientes
export const RESULTADOS: Resultado[] = [
  { id: '1', pacienteId: '1', pacienteNombre: 'Juan Carlos Mendez', estudio: 'Hematologia Completa', fecha: new Date().toISOString().split('T')[0], estado: 'validado', medicoValidador: 'Dra. Maria Garcia' },
  { id: '2', pacienteId: '1', pacienteNombre: 'Juan Carlos Mendez', estudio: 'Glicemia', fecha: new Date().toISOString().split('T')[0], estado: 'validado', medicoValidador: 'Dra. Maria Garcia' },
  { id: '3', pacienteId: '2', pacienteNombre: 'Maria Elena Rodriguez', estudio: 'Perfil Lipidico', fecha: new Date().toISOString().split('T')[0], estado: 'pendiente' },
  { id: '4', pacienteId: '3', pacienteNombre: 'Carlos Alberto Perez', estudio: 'Perfil Hepatico', fecha: new Date().toISOString().split('T')[0], estado: 'pendiente' },
  { id: '5', pacienteId: '3', pacienteNombre: 'Carlos Alberto Perez', estudio: 'Urea y Creatinina', fecha: new Date().toISOString().split('T')[0], estado: 'pendiente' },
]

// Estadisticas del dashboard
export const ESTADISTICAS = {
  pacientesHoy: 8,
  pacientesSemana: 47,
  citasPendientes: 5,
  citasCompletadas: 2,
  resultadosPendientes: 3,
  ingresosDia: 409.00,
  ingresosSemana: 2847.50,
  ingresosMes: 12450.00,
}

// Datos para graficos
export const DATOS_GRAFICO_SEMANAL = [
  { dia: 'Lun', pacientes: 12, ingresos: 450 },
  { dia: 'Mar', pacientes: 15, ingresos: 580 },
  { dia: 'Mie', pacientes: 8, ingresos: 320 },
  { dia: 'Jue', pacientes: 18, ingresos: 720 },
  { dia: 'Vie', pacientes: 22, ingresos: 890 },
  { dia: 'Sab', pacientes: 10, ingresos: 400 },
  { dia: 'Dom', pacientes: 0, ingresos: 0 },
]

export const DATOS_ESTUDIOS_POPULARES = [
  { nombre: 'Hematologia', cantidad: 45, porcentaje: 28 },
  { nombre: 'Bioquimica', cantidad: 38, porcentaje: 24 },
  { nombre: 'Imagenologia', cantidad: 25, porcentaje: 16 },
  { nombre: 'Hormonas', cantidad: 22, porcentaje: 14 },
  { nombre: 'Urologia', cantidad: 18, porcentaje: 11 },
  { nombre: 'Otros', cantidad: 12, porcentaje: 7 },
]
