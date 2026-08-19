COMPOSE ?= docker compose -f deployments/docker-compose.yml

.PHONY: build up down restart logs ps migrate shell test email-status db-clear flush-db clean

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) down
	$(COMPOSE) up -d --build

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

migrate:
	$(COMPOSE) exec backend python manage.py migrate

shell:
	$(COMPOSE) exec backend python manage.py shell

test:
	$(COMPOSE) exec backend python manage.py test

email-status:
	$(COMPOSE) exec backend python manage.py shell -c "from django.conf import settings; print('EMAIL_BACKEND=' + settings.EMAIL_BACKEND); print('EMAIL_HOST=' + getattr(settings, 'EMAIL_HOST', '')); print('SMTP_USER_CONFIGURED=' + str(bool(getattr(settings, 'EMAIL_HOST_USER', '')))); print('SMTP_PASSWORD_CONFIGURED=' + str(bool(getattr(settings, 'EMAIL_HOST_PASSWORD', ''))))"

db-clear flush-db:
	$(COMPOSE) exec backend python manage.py flush --no-input

clean:
	$(COMPOSE) down --volumes --remove-orphans