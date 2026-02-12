/**
 * Configuración de mixes para la sección Mixcloud.
 *
 * Para agregar un mix:
 *   1. Ve al mix en Mixcloud y haz clic en "Share" → copia el link
 *   2. Pégalo en el campo `url` de un nuevo objeto
 *
 * Para quitar un mix: simplemente elimina o comenta el objeto.
 */

export interface MixData {
  /** Título que se muestra en la tarjeta */
  title: string;
  /** Texto del badge (ej: "🔥 Nuevo", "🎶 Mix") */
  badge: string;
  /** true para resaltar el badge como destacado (rojo) */
  isHot?: boolean;
  /** Link de compartir de Mixcloud (ej: https://www.mixcloud.com/Beatvicious/retromix/) */
  url: string;
}

export const MIXES: MixData[] = [
  {
    title: 'Latin House Mix',
    badge: '🔥 Nuevo',
    isHot: true,
    url: 'https://www.mixcloud.com/SubsonicProducciones/mix-latin-house/',
  },
  // Agrega más mixes aquí, ejemplo:
  {
    title: 'RetroMix',
    badge: '🎶 Mix',
    url: 'https://www.mixcloud.com/SubsonicProducciones/retromix/',
  },
];
