import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração para proxy reverso (Caddy, Nginx, etc)
app.set('trust proxy', 1);

// 1. Blindagem de cabeçalhos HTTP com Helmet (permitindo cross-origin para imagens de e-mail)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. Limitador de requisições por IP (Anti-DDoS / Brute Force)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 300, // Limite de 300 requisições por IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas requisições vindas deste IP. Por favor, tente novamente após 15 minutos.' }
});
app.use(limiter);

// 3. Configuração de CORS Restrito a origens confiáveis
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL || ''
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    } else {
      return callback(new Error('Acesso bloqueado pelo CORS.'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Servir imagens públicas para e-mails (logo, etc)
app.use('/api/images', express.static(path.join(process.cwd(), 'src/assets')));
app.use('/images', express.static(path.join(process.cwd(), 'src/assets')));
app.use('/api/images', express.static(path.join(process.cwd(), 'dist')));
app.use('/images', express.static(path.join(process.cwd(), 'dist')));

// Routes
app.use('/api', routes);

// Middleware de Erro Global
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ ERRO NÃO TRATADO:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Erro interno do servidor';
  
  res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(port, () => {});
