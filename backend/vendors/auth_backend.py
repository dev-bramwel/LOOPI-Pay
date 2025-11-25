from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, email=None, **kwargs):
        lookup = email if email else username
        if lookup is None:
            return None

        try:
            user = User.objects.get(email=lookup)
        except User.DoesNotExist:
            return None

        # ensure password is provided and is a str to satisfy type checkers
        if password is None or not isinstance(password, str):
            return None

        if user.check_password(password):
            return user
        return None
