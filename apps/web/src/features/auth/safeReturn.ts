// Destino de ?volver= sin redirección abierta: solo rutas internas que empiezan por «/».
// Se rechazan «//x» y «/\x» (el navegador los trata como otro dominio) y cualquier
// control o espacio (el parser de URL elimina tabuladores: «/\t/x» acabaría en «//x»).
export function safeReturn(volver: string | null): string {
  if (!volver || !volver.startsWith('/') || /^\/[/\\]|[\\\s\x00-\x1f]/.test(volver)) return '/';
  return volver;
}
