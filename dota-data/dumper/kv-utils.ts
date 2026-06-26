import { isKvObject, KVObject } from 'valve-kv';

export function parseNumbersRecursive(object: KVObject): void {
  for (const [key, value] of Object.entries(object)) {
    if (typeof value === 'string' && value.length > 0) {
      if (/^[+*\/]/.test(value) || /[%]/.test(value)) continue;
      const numberValue = Number(value);
      if (!Number.isNaN(numberValue)) {
        object[key] = numberValue;
      }
    } else if (isKvObject(value)) {
      parseNumbersRecursive(value);
    }
  }
}

export function removeDuplicates(object: KVObject): void {
  for (const [key, value] of Object.entries(object)) {
    if (Array.isArray(value)) {
      const newValue = value[value.length - 1];
      object[key] = newValue;
      if (isKvObject(newValue)) {
        removeDuplicates(newValue);
      }
    } else if (isKvObject(value)) {
      removeDuplicates(value);
    }
  }
}

export function mergeKvRoots(target: KVObject, source: KVObject): void {
  for (const [key, value] of Object.entries(source)) {
    if (key === 'Version') continue;
    target[key] = value;
  }
}
