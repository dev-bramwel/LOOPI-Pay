from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model

User = get_user_model()

class AccountAuthBackend(BaseBackend):
    """
    Authenticate using email and password.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        # 'username' is the parameter name expected by BaseBackend; treat it as email for this backend.
        email = username if username is not None else kwargs.get("email")
        if email is None or password is None:
            return None
        try:
            user = User.objects.get(email=email)
            if user.check_password(password):
                return user
        except User.DoesNotExist:
            return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
