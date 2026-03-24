# Convertisseur de polices — version ligne de commande

Conversion de fichiers de polices `.otf` / `.ttf` en `.woff`, `.woff2`, `.ttf` ou `.otf` via le terminal, avec la librairie Python **fonttools**.

---

## Prérequis

- Python 3.x
- fonttools

```bash
pip install fonttools
```

> Pour la conversion en WOFF2, le module `brotli` est également requis :
> ```bash
> pip install brotli
> ```

---

## Utilisation

```bash
python convert_cmd.py <fichier_source> <fichier_sortie>
```

### Exemples

Convertir en WOFF :
```bash
python convert_cmd.py inputh/IBMPlexSans-Bold.otf outputh/IBMPlexSans-Bold.woff
```

Convertir en WOFF2 :
```bash
python convert_cmd.py inputh/IBMPlexSans-Bold.otf outputh/IBMPlexSans-Bold.woff2
```

Convertir en TTF :
```bash
python convert_cmd.py inputh/IBMPlexSans-Bold.otf outputh/IBMPlexSans-Bold.ttf
```

---

## Formats supportés

| Extension de sortie | Format généré |
|---------------------|---------------|
| `.woff`             | WOFF          |
| `.woff2`            | WOFF2         |
| `.ttf`              | TrueType      |
| `.otf`              | OpenType      |

Le format de sortie est détecté automatiquement depuis l'extension du fichier de sortie.

---

## Aide intégrée

```bash
python convert_cmd.py --help
```

```
usage: convert_cmd.py [-h] input output

Convertit une police OTF/TTF en WOFF, WOFF2, TTF ou OTF.

positional arguments:
  input       Chemin du fichier source (ex: inputh/font.otf)
  output      Chemin du fichier de sortie (ex: outputh/font.woff)
```
