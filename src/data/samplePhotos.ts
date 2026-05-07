/**
 * Sample photos for the AI opponent's "summoned" creatures so the visual
 * fantasy holds up even before any cloud assets exist.
 *
 * These are SVG data URIs of stylized silhouettes — they always work, no
 * external image fetches. Each is element-tinted to suggest the creature.
 */

const svg = (color: string, accent: string, shape: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
    <defs><radialGradient id='g' cx='50%' cy='40%'><stop offset='0%' stop-color='${accent}'/><stop offset='100%' stop-color='${color}'/></radialGradient></defs>
    <rect width='200' height='200' fill='url(#g)'/>
    ${shape}
  </svg>`)}`;

export const SAMPLE_PHOTOS = {
  emberA: svg('#3a1208', '#e8633a', "<g fill='#1a0604'><ellipse cx='100' cy='130' rx='55' ry='32'/><circle cx='100' cy='80' r='35'/><polygon points='80,55 90,30 100,55'/><polygon points='100,55 110,30 120,55'/><circle cx='90' cy='80' r='3' fill='#fff'/><circle cx='110' cy='80' r='3' fill='#fff'/></g>"),
  emberB: svg('#3a1208', '#ffb38a', "<g fill='#1a0604'><polygon points='100,30 130,80 160,70 140,120 100,170 60,120 40,70 70,80'/></g>"),
  tideA:  svg('#0e2c4a', '#9ed6f7', "<g fill='#051a30'><ellipse cx='100' cy='110' rx='60' ry='40'/><polygon points='40,110 20,90 25,140'/><polygon points='160,110 180,90 175,140'/><circle cx='90' cy='100' r='3' fill='#fff'/><circle cx='110' cy='100' r='3' fill='#fff'/></g>"),
  tideB:  svg('#0e2c4a', '#3a8fc4', "<g fill='#051a30' opacity='0.9'><path d='M50,140 Q60,110 80,120 Q90,90 110,100 Q120,70 140,80 Q150,50 160,60 L160,180 L50,180 Z'/></g>"),
  bloomA: svg('#1a3a1f', '#b9e3b8', "<g><circle cx='100' cy='80' r='25' fill='#5ea863'/><circle cx='75' cy='105' r='25' fill='#5ea863'/><circle cx='125' cy='105' r='25' fill='#5ea863'/><circle cx='100' cy='130' r='25' fill='#5ea863'/><circle cx='100' cy='105' r='15' fill='#f4d04a'/><rect x='95' y='130' width='10' height='50' fill='#3a5524'/></g>"),
  bloomB: svg('#1a3a1f', '#5ea863', "<g fill='#0a1f0d'><polygon points='100,30 110,80 100,130 90,80'/><polygon points='30,100 80,90 130,100 80,110'/><circle cx='100' cy='100' r='15' fill='#f4d04a'/></g>"),
  gustA:  svg('#3a3520', '#f4e8a8', "<g fill='#1a1908'><polygon points='100,40 130,90 100,160 70,90'/><polygon points='60,100 30,80 50,130'/><polygon points='140,100 170,80 150,130'/></g>"),
  gustB:  svg('#3a3520', '#c8b46a', "<g fill='#1a1908' opacity='0.85'><circle cx='100' cy='100' r='40'/><polygon points='100,40 110,80 100,160 90,80' opacity='0.5'/></g>"),
  voidA:  svg('#1a0c2a', '#c9a8e8', "<g><circle cx='100' cy='100' r='60' fill='none' stroke='#7a4ea8' stroke-width='3'/><circle cx='100' cy='100' r='40' fill='#0a0214'/><circle cx='100' cy='100' r='15' fill='#c9a8e8'/></g>"),
  voidB:  svg('#1a0c2a', '#7a4ea8', "<g fill='#0a0214'><polygon points='100,30 130,90 170,100 130,110 100,170 70,110 30,100 70,90'/></g>"),
};
