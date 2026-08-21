from django.http import JsonResponse, HttpResponseForbidden

class AdminAccessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path.lower()
        
        # Protect all admin-panel api calls and UI paths (administrator/mapping)
        if path.startswith('/admin-panel/') or path.startswith('/administrator') or path.startswith('/mapping'):
            if not request.user.is_authenticated or not request.user.is_staff:
                if '/api/' in path:
                    return JsonResponse({"success": False, "error": "Access denied. Administrative privileges required."}, status=403)
                return HttpResponseForbidden("Access Denied: Standard users cannot access administrative paths.")
            
            # Block administrative API access if TOTP is enabled but not verified in the session
            if getattr(request.user, "totp_enabled", False) and not request.session.get("totp_verified", False):
                if '/api/' in path:
                    return JsonResponse({"success": False, "error": "MFA verification required."}, status=403)
                
        return self.get_response(request)
