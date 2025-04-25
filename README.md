# Fastify GPT Swagger TS

یک پلاگین Fastify که به صورت خودکار مستندات Swagger را با استفاده از OpenAI GPT تولید می‌کند و ولیدیشن خودکار را نیز اعمال می‌کند.

## ویژگی‌ها

- تولید خودکار مستندات Swagger از روت‌های Fastify
- استفاده از هوش مصنوعی برای تحلیل کد و تولید اسکیما
- ولیدیشن خودکار درخواست‌ها بر اساس اسکیمای تولید شده
- پشتیبانی از TypeScript
- امکان تولید خودکار یا دستی مستندات
- رابط کاربری Swagger UI
- پیام‌های خطای دقیق و مفید

## نصب

```bash
npm install fastify-gpt-swagger-ts
```

## استفاده

```typescript
import fastify from 'fastify'
import fastifyGptSwagger from 'fastify-gpt-swagger-ts'

const app = fastify()

// رجیستر کردن پلاگین
app.register(fastifyGptSwagger, {
  openaiApiKey: 'your-openai-api-key',
  routesDir: './routes', // مسیر پوشه روت‌ها (اختیاری)
  autoGenerate: true, // تولید خودکار مستندات (اختیاری)
  enableValidation: true // فعال کردن ولیدیشن خودکار (اختیاری)
})

// روت‌های شما
app.post('/users', async (request, reply) => {
  const { name, age } = request.body
  return { success: true }
})

// دسترسی به مستندات
// GET /docs/json - دریافت مستندات به صورت JSON
// GET /docs - مشاهده مستندات در Swagger UI

app.listen({ port: 3000 })
```

## تنظیمات

| گزینه | نوع | پیش‌فرض | توضیحات |
|-------|-----|---------|----------|
| openaiApiKey | string | - | کلید API OpenAI (الزامی) |
| routesDir | string | './routes' | مسیر پوشه روت‌ها |
| autoGenerate | boolean | false | تولید خودکار مستندات در زمان اجرا |
| swaggerUiPath | string | '/docs' | مسیر رابط کاربری Swagger |
| enableValidation | boolean | true | فعال کردن ولیدیشن خودکار |

## تولید دستی مستندات

```typescript
// تولید دستی مستندات
const swaggerJson = await app.generateSwaggerFromRoutes()
```

## ولیدیشن خودکار

این پلاگین به صورت خودکار برای هر روت، قوانین ولیدیشن را تشخیص می‌دهد و اعمال می‌کند. برای مثال:

```typescript
// روت با ولیدیشن خودکار
app.post('/users', async (request, reply) => {
  const { name, age } = request.body
  return { success: true }
})

// درخواست نامعتبر:
// POST /users
// { "name": "علی" } // خطا: فیلد age الزامی است
// پاسخ:
// {
//   "error": "Validation failed",
//   "details": [
//     "Body validation failed: must have required property 'age'"
//   ]
// }

// درخواست معتبر:
// POST /users
// { "name": "علی", "age": 25 } // موفق
```

## نحوه کار ولیدیشن

1. پلاگین کد روت‌ها را تحلیل می‌کند
2. با استفاده از GPT، اسکیما و قوانین ولیدیشن را تولید می‌کند
3. برای هر روت، یک ولیدیتور اختصاصی می‌سازد
4. قبل از اجرای هر درخواست، ولیدیشن انجام می‌شود
5. در صورت خطا، پاسخ با کد 400 و جزئیات خطا برگردانده می‌شود

## مجوز

MIT 