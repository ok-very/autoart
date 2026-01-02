/**
 * UI Component Library
 * 
 * Architecture:
 * - atoms/     : Pure presentational, no domain knowledge
 * - molecules/ : Receive view models, compose atoms
 * - composites/: Invoke domain factories, orchestrate molecules
 * 
 * Import hierarchy (strict):
 * - atoms import nothing from ui/
 * - molecules import only from atoms/
 * - composites import from atoms/ and molecules/
 */

export * from './atoms';
export * from './molecules';
export * from './composites';
