/**
 * Generate a unique ID for components
 */
export function generateUniqueId(): string {
	return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce function to limit the rate of function calls
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	immediate?: boolean
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null;
	return function executedFunction(...args: Parameters<T>) {
		const later = function() {
			timeout = null;
			if (!immediate) func(...args);
		};
		const callNow = immediate && !timeout;
		clearTimeout(timeout!);
		timeout = setTimeout(later, wait);
		if (callNow) func(...args);
	};
}