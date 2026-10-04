"""Usage: python qr.py http://192.168.137.1:5000   -> writes qr.png"""
import sys, qrcode
url = sys.argv[1] if len(sys.argv) > 1 else "http://192.168.137.1:5000"
img = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=14, border=3)
img.add_data(url); img.make(fit=True)
img.make_image(fill_color="#5C0000", back_color="white").save("qr.png")
print("Saved qr.png for", url)
