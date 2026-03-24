import argparse
import os
import sys
from fontTools.ttLib import TTFont

# Mapping of output file extensions to fonttools flavor values.
# TTF and OTF have no flavor (None), WOFF and WOFF2 require their respective string.
FLAVORS = {
    ".woff": "woff",
    ".woff2": "woff2",
    ".ttf": None,
    ".otf": None,
}


def convert_font(input_path, output_path):
    """Convert a font file from one format to another using fontTools."""

    # Validate input file existence
    if not os.path.isfile(input_path):
        print(f"Error: input file not found: {input_path}")
        sys.exit(1)

    # Extract and validate the output extension
    _, ext = os.path.splitext(output_path)
    ext = ext.lower()
    if ext not in FLAVORS:
        print(f"Unsupported format: '{ext}'. Accepted: {', '.join(FLAVORS)}")
        sys.exit(1)

    # Ensure output directory exists
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Load the source font (fonttools auto-detects the input format)
    font = TTFont(input_path)

    # Set the output flavor (None for TTF/OTF, "woff"/"woff2" for web formats)
    font.flavor = FLAVORS[ext]

    font.save(output_path)
    print(f"Converted: {input_path} -> {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert a font file (OTF/TTF/WOFF/WOFF2) to another format."
    )
    parser.add_argument("input",  help="Path to the source font file (e.g. input/font.otf)")
    parser.add_argument("output", help="Path to the output font file (e.g. output/font.woff)")
    args = parser.parse_args()

    convert_font(args.input, args.output)
