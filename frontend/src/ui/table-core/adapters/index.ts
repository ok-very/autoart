/**
 * Table Core Adapters
 *
 * Adapters bridge domain data types to the RowModel interface.
 */

// Flat records adapter (DataRecord[])
export { makeFlatRowModel, type FlatRecord } from './FlatRowModelAdapter';

// ActionView adapter (from Actions/Events system)
export { makeActionViewRowModel, getActionViewData } from './ActionViewRowModelAdapter';

// Hierarchy nodes adapter (HierarchyNode[] with nesting)
export {
    makeHierarchyRowModel,
    getHierarchyMeta,
    type HierarchyNodeLike,
    type HierarchyRowModelOptions,
} from './HierarchyRowModelAdapter';
