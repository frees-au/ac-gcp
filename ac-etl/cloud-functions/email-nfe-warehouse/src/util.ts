import { Base64 } from 'js-base64';

export function decodeBase64(str: string): string {
  str = str.replace(/_/g, '/').replace(/-/g, '+'); // important line
  return Base64.atob(str);
}
