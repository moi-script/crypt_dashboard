import { nanoid } from 'nanoid';

export function generateMyId(id_number : number) {
  const id = nanoid(id_number);
  return id;
}