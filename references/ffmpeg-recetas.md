# Recetas de ffmpeg usadas por render.mjs

Cada corte, recorte y efecto del EDL se traduce a un filtro dentro de un único
`-filter_complex`. Estas son las recetas mínimas, para no reinventarlas cada vez.

## Trim + concat (segmentos mantener=true)

```
[0:v]trim=start=IN:end=OUT,setpts=PTS-STARTPTS[v0]
[0:a]atrim=start=IN:end=OUT,asetpts=PTS-STARTPTS[a0]
...
[v0][a0][v1][a1]concat=n=2:v=1:a=1[vcat][acat]
```

`setpts`/`asetpts` son obligatorios: sin ellos cada segmento arrastra su
timestamp original y el resultado queda con huecos.

## Recorte a 9:16 (centrado o anclado)

```
crop='min(iw,ih*ANCHO/ALTO)':'min(ih,iw*ALTO/ANCHO)':'(iw-CROP_W)*ANCLA':'(ih-CROP_H)/2',scale=ANCHO:ALTO
```

`min(iw, ih*ANCHO/ALTO)` recorta el ancho si la fuente es más panorámica que
el destino; `min(ih, iw*ALTO/ANCHO)` recorta el alto si la fuente ya es más
vertical. `ANCLA` es `recorte.anclaX` del EDL (0 = izquierda, 1 = derecha,
0.5 = centro); el eje vertical siempre se centra.

## Zoom suave con easing (1.0 → factor → 1.0)

```
zoompan=z='1+(FACTOR-1)*sin(PI*(time-EN)/DURACION)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=ANCHOxALTO:fps=FPS
```

El `sin(PI*...)` sube de 0 a 1 y vuelve a 0 a lo largo de la ventana
`[en, en+duracion]`, dando una curva suave en vez de un salto brusco.

## Título / lower-third con caja semitransparente

```
drawtext=fontfile='FUENTE.ttf':text='TEXTO':fontsize=64:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=20:x=(w-text_w)/2:y=Y:enable='between(t,DESDE,HASTA)'
```

`enable='between(t,...)'` hace que el texto solo aparezca en esa ventana de
tiempo del RESULTADO. El texto debe escaparse (`:`, `'`, `%`, `\`) antes de
interpolarlo en el filtro.

## Subtítulos quemados (ASS)

```
ass='RUTA/subs.ass':fontsdir='RUTA/templates/fonts'
```

Requiere un ffmpeg con libass. **El ffmpeg normal de Homebrew en Mac no lo
trae** (lo deja fuera a propósito); hay que instalar `ffmpeg-full` en su
lugar. `scripts/lib/paths.mjs` ya detecta esto solo y usa el binario
correcto si existe.

**Qué nombre poner en `Fontname` de un Style ASS**, confirmado probando
(no es teoría de la spec): libass, al escanear `fontsdir`, empareja por el
**nameID 1** de la tabla `name` del archivo (el "family name" clásico, p.
ej. `"Inter Black"`), NO por el nameID 16 (la "familia tipográfica
preferida", que para ese mismo archivo es solo `"Inter"`). Si se usa el 16,
el peso no se encuentra y cae en silencio a una fuente del sistema, sin
error. `scripts/lib/fonts.mjs` ya lee el nameID 1 correcto; usa
`nombreAssDeFuente()` de `scripts/lib/brand.mjs`, nunca el string crudo del
brand sheet.

Además: en una fuente **variable** (un solo archivo con varios pesos vía la
tabla `fvar`), libass solo ve el nameID 1 de la instancia por defecto —
nombres de instancia con peso como `"Lora Bold"` no existen como family
aparte y tampoco se encuentran. Por eso `scripts/fonts.mjs` prefiere siempre
descargar un archivo estático por peso (p. ej. `Poppins-Black.ttf`) en vez
de confiar en una instancia con nombre de una fuente variable.

## Logos e imágenes superpuestas

```
[1:v][vcrop]scale2ref=w='main_w*0.2':h=-1[logo][vcrop2]
[vcrop2][logo]overlay=main_w-overlay_w-40:40:enable='between(t,0.5,3.5)'[vimg]
```

`scale2ref` escala el PRIMER input tomando el SEGUNDO como referencia (de
ahí `main_w` dentro de la expresión de ancho); da dos salidas, la imagen ya
escalada y el video de referencia intacto, en ese orden. Así el logo queda
proporcional al ancho del video sin tener que calcular píxeles a mano.
`overlay` superpone respetando el canal alfa del PNG. Las imágenes se
superponen antes que los subtítulos (quedan por debajo) para que el texto
nunca se tape.

## Música con ducking

```
[1:a]volume=0.15,atrim=duration=DURACION_RESULTADO[musica]
[musica][acat]sidechaincompress=threshold=0.05:ratio=8:attack=50:release=400[ducked]
[acat][ducked]amix=inputs=2:duration=first:weights=1 1[amix]
[amix]afade=t=out:st=DURACION_RESULTADO-1:d=1[afin]
```

`sidechaincompress` baja el volumen de la música cuando hay voz (la propia
voz es la "sidechain" que dispara la compresión). El input de música entra
con `-stream_loop -1` por si la pista es más corta que el video.

## Normalización final

```
loudnorm=I=-14:TP=-1.5:LRA=11
```

Solo en `--final` (el borrador no la necesita). `-14 LUFS` es el estándar
cómodo para Reels/TikTok/Shorts.

## Duración y metadata del contenedor

```
-t DURACION_RESULTADO -map_metadata -1
```

Sin esto, un input de música en loop infinito (o la metadata del archivo
fuente) puede dejar mal la duración del contenedor de salida aunque el
stream de video ya esté bien recortado — se descubrió probando con un
clip real, no es un caso hipotético.
