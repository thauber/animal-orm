import { IndexValue } from "./Field";

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function decapitalize(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function depluralize(str: string): string {
  if (str.endsWith('ies')) {
    return str.slice(0, -3) + 'y';
  }
  if (str.endsWith('s')) {
    return str.slice(0, -1);
  }
  return str;
}

export function sortToValues(sort: string[] | undefined): IndexValue[] {
  return (sort || ['-ts']).map<IndexValue>(field => {
    const isReversed = field.startsWith('-');
    const fieldName = isReversed ? field.substring(1) : field;
    return { field: (fieldName === 'ts' || fieldName === 'ref') ? [fieldName] : ['data', fieldName], reverse: isReversed };
  })
}