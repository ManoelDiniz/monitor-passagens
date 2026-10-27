/**
 * Erros que sabem virar resposta HTTP. As camadas de servico lancam estes;
 * o handler do Fastify traduz. Assim o controller nao precisa de if de erro.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends HttpError {
  constructor(readonly problems: string[]) {
    super(400, problems.join('; '));
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'rota nao encontrada') {
    super(404, message);
  }
}
