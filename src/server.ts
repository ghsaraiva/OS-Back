import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Logger Middleware Global
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`\n[${new Date().toISOString()}] 📥 ${req.method} ${req.url}`);
  if (Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

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

app.listen(port, () => {
  console.log(`🚀 Servidor de cálculos rodando na porta ${port}`);
});
