import argparse
from pathlib import Path

from converter import convert_835_to_mir


def main():
    parser = argparse.ArgumentParser(description="Convert an X12 835 file to fixed-width MIR/MO records.")
    parser.add_argument("input", help="Path to 835/X12/text file")
    parser.add_argument("-o", "--output", help="Output MIR path")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output) if args.output else input_path.with_suffix(".mir")

    text = input_path.read_text(encoding="utf-8", errors="replace")
    mir_text, summary = convert_835_to_mir(text)
    output_path.write_text(mir_text, encoding="ascii", errors="replace", newline="")

    print(f"Generated: {output_path}")
    print(f"Claims: {summary['claims']}")
    print(f"Services: {summary['services']}")
    print(f"MIR records: {summary['mir_records']}")
    print(f"Claims split across multiple MIR records: {summary['split_claims']}")


if __name__ == "__main__":
    main()
