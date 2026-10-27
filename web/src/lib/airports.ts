/**
 * Catálogo de aeroportos brasileiros.
 *
 * Existe por um motivo prático: ninguém decora sigla de aeroporto. O formulário
 * de rota pede um código IATA de três letras, e digitar "FOR" de cabeça só
 * funciona para os dois ou três trechos que você usa sempre.
 *
 * A lista é estática de propósito — não há API pública estável e gratuita de
 * aeroportos, e o conjunto muda uma ou duas vezes por década. Se faltar algum,
 * o campo continua aceitando as três letras digitadas à mão: o catálogo ajuda,
 * não obriga.
 *
 * Cada sigla, cidade e UF foi conferida contra a base da OurAirports
 * (davidmegginson.github.io/ourairports-data/airports.csv). Ficaram de fora, de
 * propósito, os campos sem voo comercial de passageiro — inclusive Jacarepaguá
 * (RRJ), que é aviação executiva e não aparece em busca de passagem.
 */

export interface Aeroporto {
  /** Código IATA de três letras — o que a API de preços realmente consome. */
  iata: string;
  cidade: string;
  /** Sigla da unidade federativa. Chave de ESTADOS. */
  uf: string;
  /** Nome do aeroporto, sem o "Aeroporto Internacional de" na frente. */
  nome: string;
}

export const ESTADOS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AM: 'Amazonas',
  AP: 'Amapá',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  PA: 'Pará',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  PI: 'Piauí',
  PR: 'Paraná',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RO: 'Rondônia',
  RR: 'Roraima',
  RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  SE: 'Sergipe',
  SP: 'São Paulo',
  TO: 'Tocantins',
};

export const AEROPORTOS: Aeroporto[] = [
  // Acre
  { iata: 'RBR', cidade: 'Rio Branco', uf: 'AC', nome: 'Plácido de Castro' },
  { iata: 'CZS', cidade: 'Cruzeiro do Sul', uf: 'AC', nome: 'Cruzeiro do Sul' },

  // Alagoas
  { iata: 'MCZ', cidade: 'Maceió', uf: 'AL', nome: 'Zumbi dos Palmares' },

  // Amapá
  { iata: 'MCP', cidade: 'Macapá', uf: 'AP', nome: 'Alberto Alcolumbre' },
  { iata: 'OYK', cidade: 'Oiapoque', uf: 'AP', nome: 'Oiapoque' },

  // Amazonas
  { iata: 'MAO', cidade: 'Manaus', uf: 'AM', nome: 'Eduardo Gomes' },
  { iata: 'TFF', cidade: 'Tefé', uf: 'AM', nome: 'Tefé' },
  { iata: 'TBT', cidade: 'Tabatinga', uf: 'AM', nome: 'Tabatinga' },
  { iata: 'PIN', cidade: 'Parintins', uf: 'AM', nome: 'Júlio Belém' },
  { iata: 'SJL', cidade: 'São Gabriel da Cachoeira', uf: 'AM', nome: 'São Gabriel da Cachoeira' },
  { iata: 'CIZ', cidade: 'Coari', uf: 'AM', nome: 'Coari' },
  { iata: 'BAZ', cidade: 'Barcelos', uf: 'AM', nome: 'Barcelos' },
  { iata: 'LBR', cidade: 'Lábrea', uf: 'AM', nome: 'Lábrea' },
  { iata: 'ERN', cidade: 'Eirunepé', uf: 'AM', nome: 'Amaury Feitosa Tomaz' },
  { iata: 'CAF', cidade: 'Carauari', uf: 'AM', nome: 'Carauari' },
  { iata: 'MNX', cidade: 'Manicoré', uf: 'AM', nome: 'Manicoré' },
  { iata: 'HUW', cidade: 'Humaitá', uf: 'AM', nome: 'Humaitá' },
  { iata: 'IRZ', cidade: 'Santa Isabel do Rio Negro', uf: 'AM', nome: 'Tapuruquara' },
  { iata: 'RBB', cidade: 'Borba', uf: 'AM', nome: 'Borba' },

  // Bahia
  { iata: 'SSA', cidade: 'Salvador', uf: 'BA', nome: 'Deputado Luís Eduardo Magalhães' },
  { iata: 'IOS', cidade: 'Ilhéus', uf: 'BA', nome: 'Jorge Amado' },
  { iata: 'BPS', cidade: 'Porto Seguro', uf: 'BA', nome: 'Porto Seguro' },
  { iata: 'VDC', cidade: 'Vitória da Conquista', uf: 'BA', nome: 'Glauber Rocha' },
  { iata: 'LEC', cidade: 'Lençóis', uf: 'BA', nome: 'Horácio de Mattos (Chapada Diamantina)' },
  { iata: 'BRA', cidade: 'Barreiras', uf: 'BA', nome: 'Barreiras' },
  { iata: 'FEC', cidade: 'Feira de Santana', uf: 'BA', nome: 'João Durval Carneiro' },
  { iata: 'TXF', cidade: 'Teixeira de Freitas', uf: 'BA', nome: '9 de Maio' },
  { iata: 'UNA', cidade: 'Una', uf: 'BA', nome: 'Comandatuba' },
  { iata: 'PAV', cidade: 'Paulo Afonso', uf: 'BA', nome: 'Paulo Afonso' },
  { iata: 'LAZ', cidade: 'Bom Jesus da Lapa', uf: 'BA', nome: 'Bom Jesus da Lapa' },
  { iata: 'GNM', cidade: 'Guanambi', uf: 'BA', nome: 'Guanambi' },
  { iata: 'VAL', cidade: 'Valença', uf: 'BA', nome: 'Valença' },

  // Ceará
  { iata: 'FOR', cidade: 'Fortaleza', uf: 'CE', nome: 'Pinto Martins' },
  { iata: 'JDO', cidade: 'Juazeiro do Norte', uf: 'CE', nome: 'Orlando Bezerra de Menezes' },
  /* Fica no município de Cruz, mas ninguém procura "Cruz": procura Jericoacoara. */
  { iata: 'JJD', cidade: 'Jericoacoara', uf: 'CE', nome: 'Comandante Ariston Pessoa (Cruz)' },
  { iata: 'ARX', cidade: 'Aracati', uf: 'CE', nome: 'Dragão do Mar (Canoa Quebrada)' },

  // Distrito Federal
  { iata: 'BSB', cidade: 'Brasília', uf: 'DF', nome: 'Presidente Juscelino Kubitschek' },

  // Espírito Santo
  { iata: 'VIX', cidade: 'Vitória', uf: 'ES', nome: 'Eurico de Aguiar Salles' },
  { iata: 'SBJ', cidade: 'São Mateus', uf: 'ES', nome: 'São Mateus' },
  { iata: 'GUZ', cidade: 'Guarapari', uf: 'ES', nome: 'Guarapari' },

  // Goiás
  { iata: 'GYN', cidade: 'Goiânia', uf: 'GO', nome: 'Santa Genoveva' },
  { iata: 'CLV', cidade: 'Caldas Novas', uf: 'GO', nome: 'Nelson Ribeiro Guimarães' },
  { iata: 'RVD', cidade: 'Rio Verde', uf: 'GO', nome: 'General Leite de Castro' },
  { iata: 'APS', cidade: 'Anápolis', uf: 'GO', nome: 'Anápolis' },

  // Maranhão
  { iata: 'SLZ', cidade: 'São Luís', uf: 'MA', nome: 'Marechal Cunha Machado' },
  { iata: 'IMP', cidade: 'Imperatriz', uf: 'MA', nome: 'Prefeito Renato Moreira' },
  { iata: 'BRB', cidade: 'Barreirinhas', uf: 'MA', nome: 'Barreirinhas (Lençóis Maranhenses)' },
  { iata: 'BSS', cidade: 'Balsas', uf: 'MA', nome: 'Balsas' },

  // Mato Grosso
  { iata: 'CGB', cidade: 'Cuiabá', uf: 'MT', nome: 'Marechal Rondon' },
  { iata: 'SMT', cidade: 'Sorriso', uf: 'MT', nome: 'Adolino Bedin' },
  { iata: 'OPS', cidade: 'Sinop', uf: 'MT', nome: 'Presidente João Batista Figueiredo' },
  { iata: 'AFL', cidade: 'Alta Floresta', uf: 'MT', nome: 'Piloto Osvaldo Marques Dias' },
  { iata: 'ROO', cidade: 'Rondonópolis', uf: 'MT', nome: 'Maestro Marinho Franco' },
  { iata: 'BPG', cidade: 'Barra do Garças', uf: 'MT', nome: 'Barra do Garças' },
  { iata: 'CCX', cidade: 'Cáceres', uf: 'MT', nome: 'Cáceres' },
  { iata: 'JIA', cidade: 'Juína', uf: 'MT', nome: 'Juína' },
  { iata: 'TGQ', cidade: 'Tangará da Serra', uf: 'MT', nome: 'Tangará da Serra' },

  // Mato Grosso do Sul
  { iata: 'CGR', cidade: 'Campo Grande', uf: 'MS', nome: 'Campo Grande' },
  { iata: 'DOU', cidade: 'Dourados', uf: 'MS', nome: 'Francisco de Matos Pereira' },
  { iata: 'CMG', cidade: 'Corumbá', uf: 'MS', nome: 'Corumbá' },
  { iata: 'PMG', cidade: 'Ponta Porã', uf: 'MS', nome: 'Ponta Porã' },
  { iata: 'TJL', cidade: 'Três Lagoas', uf: 'MS', nome: 'Plínio Alarcom' },
  { iata: 'BYO', cidade: 'Bonito', uf: 'MS', nome: 'Bonito' },

  // Minas Gerais
  { iata: 'CNF', cidade: 'Belo Horizonte', uf: 'MG', nome: 'Tancredo Neves (Confins)' },
  { iata: 'PLU', cidade: 'Belo Horizonte', uf: 'MG', nome: 'Carlos Drummond de Andrade (Pampulha)' },
  { iata: 'UDI', cidade: 'Uberlândia', uf: 'MG', nome: 'Ten. Cel. Av. César Bombonato' },
  { iata: 'UBA', cidade: 'Uberaba', uf: 'MG', nome: 'Mário de Almeida Franco' },
  { iata: 'MOC', cidade: 'Montes Claros', uf: 'MG', nome: 'Mário Ribeiro' },
  { iata: 'IPN', cidade: 'Ipatinga', uf: 'MG', nome: 'Usiminas' },
  { iata: 'IZA', cidade: 'Juiz de Fora', uf: 'MG', nome: 'Presidente Itamar Franco (Zona da Mata)' },
  { iata: 'JDF', cidade: 'Juiz de Fora', uf: 'MG', nome: 'Francisco de Assis' },
  { iata: 'GVR', cidade: 'Governador Valadares', uf: 'MG', nome: 'Governador Valadares' },
  { iata: 'AAX', cidade: 'Araxá', uf: 'MG', nome: 'Romeu Zema' },
  { iata: 'POJ', cidade: 'Patos de Minas', uf: 'MG', nome: 'Lourdes Luz' },
  { iata: 'DIQ', cidade: 'Divinópolis', uf: 'MG', nome: 'Brigadeiro Cabral' },
  { iata: 'VAG', cidade: 'Varginha', uf: 'MG', nome: 'Major Brigadeiro Trompowsky' },
  { iata: 'TFL', cidade: 'Teófilo Otoni', uf: 'MG', nome: 'Juscelino Kubitschek' },
  { iata: 'PYT', cidade: 'Paracatu', uf: 'MG', nome: 'Pedro Rabelo de Souza' },

  // Pará
  { iata: 'BEL', cidade: 'Belém', uf: 'PA', nome: 'Val de Cans / Júlio Cezar Ribeiro' },
  { iata: 'STM', cidade: 'Santarém', uf: 'PA', nome: 'Maestro Wilson Fonseca' },
  { iata: 'MAB', cidade: 'Marabá', uf: 'PA', nome: 'João Correa da Rocha' },
  { iata: 'ATM', cidade: 'Altamira', uf: 'PA', nome: 'Altamira' },
  { iata: 'CKS', cidade: 'Parauapebas', uf: 'PA', nome: 'Carajás' },
  { iata: 'ITB', cidade: 'Itaituba', uf: 'PA', nome: 'Itaituba' },
  { iata: 'TUR', cidade: 'Tucuruí', uf: 'PA', nome: 'Tucuruí' },
  { iata: 'RDC', cidade: 'Redenção', uf: 'PA', nome: 'Redenção' },
  { iata: 'BVS', cidade: 'Breves', uf: 'PA', nome: 'Breves' },
  { iata: 'JPE', cidade: 'Paragominas', uf: 'PA', nome: 'Nagib Demachki' },
  { iata: 'OPP', cidade: 'Salinópolis', uf: 'PA', nome: 'Salinópolis' },
  { iata: 'TMT', cidade: 'Oriximiná', uf: 'PA', nome: 'Trombetas' },
  { iata: 'GGF', cidade: 'Almeirim', uf: 'PA', nome: 'Almeirim' },

  // Paraíba
  { iata: 'JPA', cidade: 'João Pessoa', uf: 'PB', nome: 'Presidente Castro Pinto' },
  { iata: 'CPV', cidade: 'Campina Grande', uf: 'PB', nome: 'Presidente João Suassuna' },
  { iata: 'CJZ', cidade: 'Cajazeiras', uf: 'PB', nome: 'Pedro Vieira Moreira' },

  // Paraná
  { iata: 'CWB', cidade: 'Curitiba', uf: 'PR', nome: 'Afonso Pena' },
  { iata: 'IGU', cidade: 'Foz do Iguaçu', uf: 'PR', nome: 'Cataratas' },
  { iata: 'LDB', cidade: 'Londrina', uf: 'PR', nome: 'Governador José Richa' },
  { iata: 'MGF', cidade: 'Maringá', uf: 'PR', nome: 'Silvio Name Júnior' },
  { iata: 'CAC', cidade: 'Cascavel', uf: 'PR', nome: 'Adalberto Mendes da Silva' },
  { iata: 'PGZ', cidade: 'Ponta Grossa', uf: 'PR', nome: 'Comandante Antonio Amilton Beraldo' },
  { iata: 'TOW', cidade: 'Toledo', uf: 'PR', nome: 'Luiz Dalcanale Filho' },
  { iata: 'PTO', cidade: 'Pato Branco', uf: 'PR', nome: 'Juvenal Loureiro Cardoso' },
  { iata: 'UMU', cidade: 'Umuarama', uf: 'PR', nome: 'Orlando de Carvalho' },
  { iata: 'GPB', cidade: 'Guarapuava', uf: 'PR', nome: 'Tancredo Thomas de Faria' },
  { iata: 'FBE', cidade: 'Francisco Beltrão', uf: 'PR', nome: 'Paulo Abdala' },
  { iata: 'UVI', cidade: 'União da Vitória', uf: 'PR', nome: 'José Cleto' },
  { iata: 'GGJ', cidade: 'Guaíra', uf: 'PR', nome: 'Guaíra' },

  // Pernambuco
  { iata: 'REC', cidade: 'Recife', uf: 'PE', nome: 'Guararapes / Gilberto Freyre' },
  { iata: 'FEN', cidade: 'Fernando de Noronha', uf: 'PE', nome: 'Fernando de Noronha' },
  { iata: 'PNZ', cidade: 'Petrolina', uf: 'PE', nome: 'Senador Nilo Coelho' },
  { iata: 'CAU', cidade: 'Caruaru', uf: 'PE', nome: 'Oscar Laranjeiras' },
  { iata: 'SET', cidade: 'Serra Talhada', uf: 'PE', nome: 'Santa Magalhães' },

  // Piauí
  { iata: 'THE', cidade: 'Teresina', uf: 'PI', nome: 'Senador Petrônio Portella' },
  { iata: 'PHB', cidade: 'Parnaíba', uf: 'PI', nome: 'Prefeito Dr. João Silva Filho' },

  // Rio de Janeiro
  { iata: 'GIG', cidade: 'Rio de Janeiro', uf: 'RJ', nome: 'Galeão / Antonio Carlos Jobim' },
  { iata: 'SDU', cidade: 'Rio de Janeiro', uf: 'RJ', nome: 'Santos Dumont' },
  { iata: 'CFB', cidade: 'Cabo Frio', uf: 'RJ', nome: 'Cabo Frio' },
  /* Cadastrado sob Cabo Frio em algumas bases, mas atende Búzios — e é assim
     que ele é vendido. CFB, logo acima, é o de Cabo Frio de verdade. */
  { iata: 'BZC', cidade: 'Búzios', uf: 'RJ', nome: 'Umberto Modiano' },
  { iata: 'MEA', cidade: 'Macaé', uf: 'RJ', nome: 'Benedito Lacerda' },
  { iata: 'CAW', cidade: 'Campos dos Goytacazes', uf: 'RJ', nome: 'Bartolomeu Lysandro' },

  // Rio Grande do Norte
  { iata: 'NAT', cidade: 'Natal', uf: 'RN', nome: 'Governador Aluízio Alves (São Gonçalo)' },
  { iata: 'MVF', cidade: 'Mossoró', uf: 'RN', nome: 'Dix-Sept Rosado' },

  // Rio Grande do Sul
  { iata: 'POA', cidade: 'Porto Alegre', uf: 'RS', nome: 'Salgado Filho' },
  { iata: 'CXJ', cidade: 'Caxias do Sul', uf: 'RS', nome: 'Hugo Cantergiani' },
  { iata: 'PET', cidade: 'Pelotas', uf: 'RS', nome: 'João Simões Lopes Neto' },
  { iata: 'RIG', cidade: 'Rio Grande', uf: 'RS', nome: 'Rio Grande' },
  { iata: 'RIA', cidade: 'Santa Maria', uf: 'RS', nome: 'Santa Maria' },
  { iata: 'CEL', cidade: 'Canela', uf: 'RS', nome: 'Canela' },
  { iata: 'PFB', cidade: 'Passo Fundo', uf: 'RS', nome: 'Lauro Kortz' },
  { iata: 'URG', cidade: 'Uruguaiana', uf: 'RS', nome: 'Rubem Berta' },
  { iata: 'GEL', cidade: 'Santo Ângelo', uf: 'RS', nome: 'Sepé Tiaraju' },
  { iata: 'SRA', cidade: 'Santa Rosa', uf: 'RS', nome: 'Luís Alberto Lehr' },
  { iata: 'IJU', cidade: 'Ijuí', uf: 'RS', nome: 'John Herbert Zorzanello' },
  { iata: 'BGX', cidade: 'Bagé', uf: 'RS', nome: 'Comandante Gustavo Kraemer' },
  { iata: 'ERM', cidade: 'Erechim', uf: 'RS', nome: 'Comandante Kraemer' },

  // Rondônia
  { iata: 'PVH', cidade: 'Porto Velho', uf: 'RO', nome: 'Governador Jorge Teixeira de Oliveira' },
  { iata: 'BVH', cidade: 'Vilhena', uf: 'RO', nome: 'Brigadeiro Camarão' },
  { iata: 'JPR', cidade: 'Ji-Paraná', uf: 'RO', nome: 'Ji-Paraná' },
  { iata: 'OAL', cidade: 'Cacoal', uf: 'RO', nome: 'Cacoal' },
  { iata: 'GJM', cidade: 'Guajará-Mirim', uf: 'RO', nome: 'Guajará-Mirim' },

  // Roraima
  { iata: 'BVB', cidade: 'Boa Vista', uf: 'RR', nome: 'Atlas Brasil Cantanhede' },

  // Santa Catarina
  { iata: 'FLN', cidade: 'Florianópolis', uf: 'SC', nome: 'Hercílio Luz' },
  { iata: 'NVT', cidade: 'Navegantes', uf: 'SC', nome: 'Ministro Victor Konder' },
  { iata: 'JOI', cidade: 'Joinville', uf: 'SC', nome: 'Lauro Carneiro de Loyola' },
  { iata: 'XAP', cidade: 'Chapecó', uf: 'SC', nome: 'Serafin Enoss Bertaso' },
  { iata: 'CCM', cidade: 'Criciúma', uf: 'SC', nome: 'Diomício Freitas (Forquilhinha)' },
  { iata: 'JJG', cidade: 'Jaguaruna', uf: 'SC', nome: 'Humberto Ghizzo Bortoluzzi' },
  { iata: 'LAJ', cidade: 'Lages', uf: 'SC', nome: 'Antônio Correia Pinto de Macedo' },
  { iata: 'SQX', cidade: 'São Miguel do Oeste', uf: 'SC', nome: 'Hélio Wasum' },
  { iata: 'JCB', cidade: 'Joaçaba', uf: 'SC', nome: 'Santa Terezinha' },

  // São Paulo
  { iata: 'GRU', cidade: 'São Paulo', uf: 'SP', nome: 'Guarulhos / Governador André Franco Montoro' },
  { iata: 'CGH', cidade: 'São Paulo', uf: 'SP', nome: 'Congonhas / Deputado Freitas Nobre' },
  { iata: 'VCP', cidade: 'Campinas', uf: 'SP', nome: 'Viracopos' },
  { iata: 'SJP', cidade: 'São José do Rio Preto', uf: 'SP', nome: 'Prof. Eribelto Manoel Reino' },
  { iata: 'RAO', cidade: 'Ribeirão Preto', uf: 'SP', nome: 'Leite Lopes' },
  { iata: 'SJK', cidade: 'São José dos Campos', uf: 'SP', nome: 'Professor Urbano Ernesto Stumpf' },
  { iata: 'PPB', cidade: 'Presidente Prudente', uf: 'SP', nome: 'Adhemar de Barros' },
  { iata: 'ARU', cidade: 'Araçatuba', uf: 'SP', nome: 'Dario Guarita' },
  { iata: 'MII', cidade: 'Marília', uf: 'SP', nome: 'Frank Miloye Milenkowichi' },
  { iata: 'JTC', cidade: 'Bauru', uf: 'SP', nome: 'Moussa Nakhl Tobias (Arealva)' },
  { iata: 'AQA', cidade: 'Araraquara', uf: 'SP', nome: 'Bartolomeu de Gusmão' },
  { iata: 'SOD', cidade: 'Sorocaba', uf: 'SP', nome: 'Bertram Luiz Leupolz' },
  { iata: 'FRC', cidade: 'Franca', uf: 'SP', nome: 'Ten. Lund Presotto' },
  { iata: 'BAT', cidade: 'Barretos', uf: 'SP', nome: 'Chafei Amsei' },

  // Sergipe
  { iata: 'AJU', cidade: 'Aracaju', uf: 'SE', nome: 'Santa Maria' },

  // Tocantins
  { iata: 'PMW', cidade: 'Palmas', uf: 'TO', nome: 'Brigadeiro Lysias Rodrigues' },
  { iata: 'AUX', cidade: 'Araguaína', uf: 'TO', nome: 'Araguaína' },
  { iata: 'GRP', cidade: 'Gurupi', uf: 'TO', nome: 'Gurupi' },
  { iata: 'PNB', cidade: 'Porto Nacional', uf: 'TO', nome: 'Porto Nacional' },
];

/**
 * Capitais e hubs, em ordem de movimento. Serve a duas coisas: é o que o campo
 * vazio sugere e é o critério de desempate da busca — "sal" tem que abrir em
 * Salvador, não em Salinópolis.
 */
const PRINCIPAIS = [
  'GRU',
  'CGH',
  'GIG',
  'SDU',
  'BSB',
  'CNF',
  'VCP',
  'SSA',
  'REC',
  'FOR',
  'POA',
  'CWB',
  'FLN',
  'BEL',
  'MAO',
  'VIX',
  'GYN',
  'CGB',
  'NAT',
  'SLZ',
  'MCZ',
  'JPA',
  'CGR',
  'THE',
  'AJU',
  'IGU',
  'PMW',
  'PVH',
  'MCP',
  'BVB',
  'RBR',
];

const RELEVANCIA = new Map(PRINCIPAIS.map((iata, i) => [iata, i]));

const POR_IATA = new Map(AEROPORTOS.map((a) => [a.iata, a]));

export function aeroporto(iata: string | null | undefined): Aeroporto | undefined {
  return iata ? POR_IATA.get(iata.toUpperCase()) : undefined;
}

/** "Fortaleza · CE" para quem está no catálogo; a própria sigla para quem não está. */
export function cidadeDe(iata: string | null | undefined): string {
  const achado = aeroporto(iata);
  return achado ? `${achado.cidade} · ${achado.uf}` : (iata ?? '');
}

/** Acento e caixa não podem atrapalhar quem digita "sao paulo" ou "MACEIO". */
function normaliza(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Ordena por quão direto foi o acerto: sigla exata primeiro, depois começo de
 * cidade, depois estado, e só então o miolo do nome. Quem digita "sal" quer
 * Salvador antes de "Rio Grande do Sul".
 */
function pontuacao(a: Aeroporto, termo: string): number {
  const cidade = normaliza(a.cidade);
  const uf = normaliza(a.uf);
  const estado = normaliza(ESTADOS[a.uf] ?? '');
  const nome = normaliza(a.nome);
  const iata = normaliza(a.iata);

  if (iata === termo) return 0;
  if (iata.startsWith(termo)) return 1;
  if (cidade.startsWith(termo)) return 2;
  if (uf === termo) return 3;
  if (estado.startsWith(termo)) return 4;
  if (cidade.includes(termo)) return 5;
  if (nome.includes(termo)) return 6;
  if (estado.includes(termo)) return 7;
  return -1;
}

const relevancia = (a: Aeroporto) => RELEVANCIA.get(a.iata) ?? PRINCIPAIS.length;

/** Busca por sigla, cidade, estado ou nome do aeroporto. Termo vazio = principais. */
export function buscarAeroportos(termo: string, limite = 8): Aeroporto[] {
  const alvo = normaliza(termo);

  if (alvo === '') {
    return PRINCIPAIS.slice(0, limite)
      .map((iata) => POR_IATA.get(iata))
      .filter((a): a is Aeroporto => a !== undefined);
  }

  return AEROPORTOS.map((a) => ({ a, p: pontuacao(a, alvo) }))
    .filter((r) => r.p >= 0)
    .sort(
      (x, y) =>
        x.p - y.p ||
        relevancia(x.a) - relevancia(y.a) ||
        x.a.cidade.localeCompare(y.a.cidade, 'pt-BR'),
    )
    .slice(0, limite)
    .map((r) => r.a);
}
