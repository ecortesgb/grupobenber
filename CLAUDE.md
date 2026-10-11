# Instrucciones para Claude

Delega a un subagente solo tareas grandes o que se puedan correr en paralelo.
Las ediciones pequeñas hazlas directo con el modelo de la sesión.
No uses siempre Fable.
Usa Opus 5.5 para tareas más simples.

## Distribución de modelos
- Fable 5.1: arquitectura, bugs complejos y revisión de código.
- Opus 5.5: ediciones, pruebas, documentación y refactorización.
- Haiku 5.5: investigaciones y resúmenes.
- Especifica el modelo en cada llamada al subagente.

## Delegación
- Un subagente por tarea. Planifica antes de ejecutar.
- Ejecuta subagentes independientes en paralelo.
- Cuando delegues, lee el informe del subagente, no vuelvas a leer los archivos.
