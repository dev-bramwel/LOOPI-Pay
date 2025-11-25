from django.http import HttpResponse


def home(request):
    html = """
    <html>
      <head>
        <title>LOOPI++ QR Payment API</title>
        <meta charset="utf-8" />
      </head>
      <body style="font-family: Arial, sans-serif; line-height:1.6; padding:40px;">
        <h1>LOOPI++ QR Payment API</h1>
        <p>Welcome to the development server for the LOOPI++ QR Payment backend.</p>
        <ul>
          <li><a href="/swagger/">Swagger UI</a> — interactive API docs</li>
          <li><a href="/redoc/">ReDoc</a> — alternative API docs</li>
          <li><a href="/api/vendors/">Vendors API (root)</a></li>
          <li><a href="/api/payments/">Payments API (root)</a></li>
          <li><a href="/admin/">Django Admin</a></li>
        </ul>
        <p>Use these links to explore and test endpoints.</p>
      </body>
    </html>
    """
    return HttpResponse(html)
