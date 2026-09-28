import json

from django.test import Client, TestCase


class MobileApiTests(TestCase):
    """The JSON API used by the mobile client (no CSRF cookie, Bearer token auth)."""

    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def post_json(self, url, data, **headers):
        return self.client.post(url, json.dumps(data), content_type='application/json', **headers)

    def register(self):
        return self.post_json('/api/register/', {'username': 'ada', 'email': 'ada@example.com', 'password': 's3cret-pass'})

    def test_register_returns_token(self):
        res = self.register()
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.json())
        self.assertEqual(res.json()['user']['username'], 'ada')

    def test_login_with_email_and_me(self):
        self.register()
        res = self.post_json('/api/login/', {'email': 'ada@example.com', 'password': 's3cret-pass'})
        self.assertEqual(res.status_code, 200)
        token = res.json()['token']
        me = self.client.get('/api/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['email'], 'ada@example.com')

    def test_login_rejects_bad_password(self):
        self.register()
        res = self.post_json('/api/login/', {'username': 'ada', 'password': 'wrong'})
        self.assertEqual(res.status_code, 401)

    def test_me_rejects_tampered_token(self):
        token = self.register().json()['token']
        me = self.client.get('/api/me/', HTTP_AUTHORIZATION=f'Bearer {token}x')
        self.assertEqual(me.status_code, 401)

    def test_chat_replies(self):
        res = self.post_json('/api/chat/', {'message': 'Merhaba'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('ChemAI', res.json()['response'])
