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
