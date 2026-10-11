# Instrucciones para Claude

Nunca ejecutes el trabajo por tu cuenta.
Delega siempre la tarea a un subagente.
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
- Lee el informe, nunca los archivos.
