/**
 * Generate a unique ID for components
 */
export function generateUniqueId(): string {
	return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
