const express = require("express");
const cors = require("cors");
const { poolPromise, sql } = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const handleSQLError = (error) => {
  const errorMessages = {};
  let counter = 1;
  
  if (error.precedingErrors) {
    error.precedingErrors.forEach((err) => {
      errorMessages[`message-${counter.toString().padStart(2, '0')}`] = {
        code: err.code || 'UNKNOWN',
        message: err.message,
        line: err.lineNumber || null
      };
      counter++;
    });
  }
  
  if (error.message) {
    errorMessages[`message-${counter.toString().padStart(2, '0')}`] = {
      code: error.code || 'UNKNOWN',
      message: error.message,
      line: error.lineNumber || null
    };
  }

  return errorMessages;
};

//////////////////////////************* INICIO - API ZIMU *****************/////////////////////////////////

// 🟢 Endpoint criar/atualizar cliente
app.post("/clientes", async (req, res) => {
  const { celular, nome, cpf, email, assinante, pagtoEmDia, prefResp, nomeToolChamadora, nomeAgente, resumo_sobre_mim } = req.body;

  if (!celular) {
    return res.status(400).json({
      error: "O campo 'celular' é obrigatório.",
      suggestion: "Envie um JSON com o campo 'celular'."
    });
  }

  try {
    const pool = await poolPromise;

    const request = pool.request();
    request.input('Celular', sql.VarChar(20), celular);
    request.input('NomeCli', sql.VarChar(200), nome || '');
    request.input('CPF', sql.VarChar(11), cpf || '');
    request.input('eMail', sql.VarChar(50), email || '');
    request.input('Assinante', sql.VarChar(3), assinante || '');
    request.input('PagtoEmDia', sql.VarChar(3), pagtoEmDia || '');
    request.input('PrefResp', sql.VarChar(5), prefResp || '');
    request.input('NomeToolChamadora', sql.VarChar(60), nomeToolChamadora || '');
    request.input('NomeAgente', sql.VarChar(60), nomeAgente || '');
    request.input('Resumo_Sobre_Mim', sql.NVarChar(sql.MAX), resumo_sobre_mim || '');

    await request.execute('SpGrCliente');

    res.status(200).json({ message: "Cliente criado/atualizado com sucesso!" });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);
    
    res.status(400).json({
      error: "Erro ao processar a requisição",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});



// 🟢 Endpoint para listar todos os clientes
app.get("/clientes/all", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SpSeCliente");

    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Nenhum cliente encontrado!"
      });
    }

    res.status(200).json({
      message: `Clientes encontrados: ${result.recordset.length}`,
      data: result.recordset
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);
    
    res.status(500).json({
      error: "Erro ao listar clientes",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Tente novamente mais tarde"
    });
  }
});


// 🟢 Endpoint para buscar cliente por celular de forma dinâmica
app.get("/cliente/:celular", async (req, res) => {
  try {
    const { nomeAgente, nomeToolChamadora } = req.query;

    const pool = await poolPromise;
    const result = await pool.request()
      .input('Celular', sql.VarChar(15), req.params.celular)
      .input('NomeAgente', sql.VarChar(60), nomeAgente || '')
      .input('NomeToolChamadora', sql.VarChar(60), nomeToolChamadora || '')
      .execute('spse1cliente');

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(200).json({ 
        message: "Cliente não cadastrado!",
        data: null
      });
    }

    const clienteData = result.recordset[0]; // Retorna tudo dinamicamente

    res.status(200).json({
      message: "Cliente encontrado com sucesso!",
      data: clienteData
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(400).json({
      error: "Erro na busca",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined
    });
  }
});



// 🟢 Endpoint para excluir cliente por celular
app.delete("/cliente/:celular", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Celular', sql.VarChar(15), req.params.celular)
      .execute('SpExCliente');

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ 
        message: "Cliente não encontrado ou já excluído!" 
      });
    }

    res.status(200).json({
      message: "Cliente excluído com sucesso!"
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);
    
    res.status(400).json({
      error: "Erro na exclusão",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined
    });
  }
});


// 🟢 Endpoint para gravar os prompts
app.post("/prompt", async (req, res) => {
  const { prompt, instrupadrao, obs } = req.body;

  if (!prompt || !instrupadrao || !obs) {
    return res.status(400).json({
      error: "Os campos 'prompt', 'instrupadrao' e 'obs' são obrigatórios.",
      suggestion: "Envie um JSON com os campos obrigatórios preenchidos."
    });
  }

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("PromptIA", sql.VarChar(5000), prompt);
    request.input("InstrPadrao", sql.VarChar(5000), instrupadrao);
    request.input("Obs", sql.VarChar(5000), obs);

    await request.execute("SpGrComandoIA");

    res.status(201).json({
      message: "Prompt cadastrado com sucesso!",
      data: {
        prompt,
        instrupadrao,
        obs
      }
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao cadastrar o prompt",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});


// 🟢 Endpoint para listar os prompts
app.get("/prompt", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SpSe1ComandoAtu");

    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Nenhum prompt encontrado!"
      });
    }

    res.status(200).json({
      message: `Prompts encontrados: ${result.recordset.length}`,
      data: result.recordset  
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao listar os prompts",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Tente novamente mais tarde"
    });
  }
});


// 🟢 Endpoint para listar os Relatórios (recordsets)
app.get("/relatorio", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SpSeDiario");

    if (!result.recordsets || result.recordsets.length === 0) {
      return res.status(200).json({
        message: "Nenhum relatório encontrado!"
      });
    }

    res.status(200).json({
      message: `Relatórios encontrados: ${result.recordsets.reduce((acc, rs) => acc + rs.length, 0)}`,
      data: result.recordsets // Retorna todos os recordsets
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao listar os Relatórios",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Tente novamente mais tarde"
    });
  }
});


// 🟢 Endpoint para listar contatos para enviar relatório
app.get("/relatorio/contatos", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SpSeCelularAdm");

    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Nenhum contato ADM encontrado!"
      });
    }

    res.status(200).json({
      message: `Contatos ADM encontrados: ${result.recordset.length}`,
      data: result.recordset  
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao listar os contatos",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Tente novamente mais tarde"
    });
  }
});


// 🟢 Endpoint para registrar custos de tokens
app.post("/tokens", async (req, res) => {
  const { celular, prefResp, pergunta, resposta, nomeIA, dolarCota, nomeToolChamadora, nomeAgente, intencaoPergunta, focoDialogo } = req.body;

  if (!celular || !prefResp || !pergunta || !resposta || !nomeIA || !dolarCota) {
    return res.status(400).json({
      error: "Os campos 'celular', 'prefResp', 'pergunta', 'resposta', 'nomeIA' e 'dolarCota' são obrigatórios.",
      suggestion: "Envie um JSON com os campos obrigatórios preenchidos."
    });
  }

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("Celular", sql.Char(20), celular);
    request.input("PrefResp", sql.Char(5), prefResp);
    request.input("Pergunta", sql.NVarChar(sql.MAX), pergunta);
    request.input("Resposta", sql.NVarChar(sql.MAX), resposta);
    request.input("NomeIA", sql.Char(30), nomeIA);
    request.input("DolarCota", sql.Decimal(10, 6), dolarCota);
    request.input("NomeAgente", sql.NVarChar(60), nomeAgente);
    request.input("NomeToolChamadora", sql.NVarChar(60), nomeToolChamadora);
    request.input("IntencaoPergunta", sql.NVarChar(30), intencaoPergunta);
    request.input("FocoDialogo", sql.NVarChar(30), focoDialogo);


    await request.execute("SpContaTokens");

    res.status(201).json({
      message: "Registro de tokens salvo com sucesso!",
      data: {
        celular,
        prefResp,
        pergunta,
        resposta,
        nomeIA,
        dolarCota,
        nomeAgente,
        nomeToolChamadora,
        intencaoPergunta,
        focoDialogo
      }
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao registrar o custo dos tokens",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});


// 🟢 Endpoint para registrar controle financeiro
app.post("/financeiro", async (req, res) => {
  const { celular, codOper, dataOper, linhaPix, invoiceNumber, codPacote, dataCriaPix, dataRecPix, nomeAgente, nomeToolChamadora } = req.body;

  if (!celular || !codOper || !invoiceNumber || !codPacote) {
    return res.status(400).json({
      error: "Os campos 'celular', 'codOper', 'invoiceNumber' e 'codPacote' são obrigatórios.",
      suggestion: "Envie um JSON com os campos obrigatórios preenchidos."
    });
  }

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input('Celular', sql.VarChar(20), celular);
    request.input('CodOper', sql.Int, codOper);
    request.input('InvoiceNumber', sql.Int, invoiceNumber);
    request.input('CodPacote', sql.Char(5), codPacote);
    request.input('DataOper', sql.SmallDateTime, dataOper || '');
    request.input('LinhaPix', sql.VarChar(512), linhaPix || '');
    request.input('DataCriaPix', sql.VarChar(20), dataCriaPix || '');
    request.input('DataRecPix', sql.VarChar(20), dataRecPix || '');
    request.input('NomeToolChamadora', sql.VarChar(60), nomeToolChamadora || '');
    request.input('NomeAgente', sql.VarChar(60), nomeAgente || '');

    await request.execute("SpGrControleFinanc");

    res.status(201).json({
      message: "Registro financeiro salvo com sucesso!",
      data: {
        celular,
        codOper,
        dataOper: dataOper || null,
        linhaPix: linhaPix || null,
        invoiceNumber,
        codPacote,
        dataCriaPix: dataCriaPix || null,
        dataRecPix: dataRecPix || null,
        nomeToolChamadora: nomeToolChamadora || null,
        nomeAgente: nomeAgente || null
      }
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao registrar o controle financeiro",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});


// 🟢 Endpoint para listar os pacotes padrões
app.get("/pacotes/padrao", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SpSePacotePadrao");

    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Nenhum pacote encontrado!"
      });
    }

    res.status(200).json({
      message: `Pacote encontrado: ${result.recordset.length}`,
      data: result.recordset
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao lista pacote",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Tente novamente mais tarde"
    });
  }
});


// 🟢 Endpoint para listar pacotes filtrando por palavra-chave
app.get("/pacotes/palavra-chave", async (req, res) => {
  try {
    const { palavraChave } = req.query; 
    const pool = await poolPromise;
    const request = pool.request();

    if (palavraChave) {
      request.input("PalavraChave", sql.VarChar(255), palavraChave);
    }

    const result = await request.execute("SpSePacoteChave");

    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Nenhum pacote encontrado!"
      });
    }

    res.status(200).json({
      message: `Pacotes palavra-chave encontrados: ${result.recordset.length}`,
      data: result.recordset
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao listar pacotes",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Tente novamente mais tarde"
    });
  }
});



// 🟢 Endpoint para criar/atualizar thread
app.post("/threads", async (req, res) => {
  const { ThreadId, Celular, Assunto } = req.body;

  if (!ThreadId || !Celular || !Assunto) {
    return res.status(400).json({
      status: "fail",
      error: "Dados incompletos",
      suggestion: "Verifique: ThreadId (até 50 chars), Celular (até 20 chars), Assunto não vazio"
    });
  }

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input('TreadId', sql.Char(50), ThreadId);  
    request.input('Celular', sql.Char(20), Celular);
    request.input('Assunto', sql.VarChar(200), Assunto);

    const result = await request.execute('SpGrThreadIA');

    res.status(200).json({
      status: "success",
      message: "Thread criada/atualizada com sucesso",
      data: {
        ThreadId,
        Celular,
        Assunto,
        resultado: result.recordset   
      }
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      status: "fail",
      error: "Falha na operação",
      messages: errorMessages,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});


// 🟢 Endpoint para buscar thread por celular
app.get("/threads", async (req, res) => {
  try {
    const { celular } = req.query;

    if (!celular) {
      return res.status(400).json({
        status: "fail",
        error: "Parâmetro obrigatório",
        messages: {
          "message-01": {
            code: "MISSING_PARAM",
            message: "O parâmetro 'celular' é obrigatório na query string"
          }
        }
      });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('Celular', sql.Char(20), celular)  
      .execute('SpSeThreadIA');                

    res.status(200).json({
      status: "success",
      results: result.recordset.length,
      data: result.recordset
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      error: "Falha na busca",
      messages: {
        "message-01": {
          code: error.code || "UNKNOWN_ERROR",
          message: error.message
        }
      },
      suggestion: "O formato do celular deve ser '5511999999999'"
    });
  }
});


// 🟢 Endpoint para listar todas as threads
app.get("/threads/all", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .execute('SpSeThreadIA');  

    res.status(200).json({
      status: "success",
      results: result.recordset.length,
      data: result.recordset
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      error: "Falha na listagem",
      messages: handleSQLError(error),
      suggestion: "Verifique se a procedure SpSeThreadIA existe no banco"
    });
  }
});


// 🟢 Endpoint para excluir thread
app.delete("/threads", async (req, res) => {
  try {
    const { TreadId, Celular } = req.body;  

    if (!TreadId) {
      return res.status(400).json({
        status: "fail",
        error: "TreadId é obrigatório para exclusão",
        messages: {
          "message-01": {
            code: "MISSING_TREADID",
            message: "O campo 'TreadId' deve ser fornecido"
          }
        }
      });
    }

    const pool = await poolPromise;
    const request = pool.request().input('TreadId', sql.Char(50), TreadId); 

    if (Celular) {
      request.input('Celular', sql.Char(20), Celular);
    }

    await request.execute('SpExThreadIA');

    res.status(204).send(); 

  } catch (error) {
    res.status(400).json({
      status: "fail",
      error: "Exclusão falhou",
      messages: {
        "message-01": {
          code: "EREQUEST",
          message: error.message
        }
      },
      suggestion: "Verifique se a thread existe e tente novamente"
    });
  }
});

// 🔵 Endpoint GET - Buscar lead pelo nome
app.get("/lead", async (req, res) => {
  try {
    const { nome } = req.query;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return res.status(400).json({
        error: "Parâmetro 'nome' é obrigatório e deve ser uma string válida.",
        suggestion: "Utilize ?nome=João da Silva na URL."
      });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input("Nome", sql.VarChar(200), nome)
      .execute("SpSeLead");

    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Nenhum lead encontrado com o nome informado.",
        data: []
      });
    }

    res.status(200).json({
      message: `Leads encontrados: ${result.recordset.length}`,
      data: result.recordset
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao buscar o lead",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados ou consulte o suporte"
    });
  }
});

// 🟢 Endpoint para listar todos os leads 
app.get("/leads/todos", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SpSeTodos_Leads");

    if (!result || (!result.recordset && !result.recordsets)) {
      return res.status(200).json({
        message: "Nenhum dado retornado pela procedure.",
        data: []
      });
    }

    res.status(200).json({
      message: `Dados retornados com sucesso`,
      recordsets: result.recordsets  // retorna todos os conjuntos
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao buscar os leads",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique se a procedure está correta ou consulte o suporte técnico"
    });
  }
});

// 🔵 Endpoint para listar diálogo 
app.get("/dialogo", async (req, res) => {
  try {
    const { celular } = req.query;

    if (!celular || typeof celular !== 'string') {
      return res.status(400).json({
        error: "Parâmetro 'celular' é obrigatório",
        suggestion: "Inclua ?celular=XXXXXXXXXXX na URL"
      });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input("Celular", sql.Char(20), celular)
      .execute("SpSeDialogo");

    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Nenhum diálogo encontrado para este número",
        data: []
      });
    }

    res.status(200).json({
      message: `Diálogos encontrados: ${result.recordset.length}`,
      data: result.recordset
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao buscar diálogo",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});

// 🟢 Endpoint para salvar uma recomendação
app.post("/recomendacao/enviar", async (req, res) => {
  const { celPrinc, celSugestao, mensagem, dataEnv } = req.body;

  // Validação básica
  if (!celPrinc || !celSugestao || !mensagem || !dataEnv) {
    return res.status(400).json({
      error: "Todos os campos são obrigatórios: celPrinc, celSugestao, mensagem e dataEnv",
      suggestion: "Verifique se todos os dados estão sendo enviados corretamente"
    });
  }

  try {
    const pool = await poolPromise;

    const request = pool.request();
    request.input("CelPrinc", sql.Char(20), celPrinc);
    request.input("CelSugestao", sql.Char(20), celSugestao);
    request.input("Mensagem", sql.NVarChar(sql.MAX), mensagem);
    request.input("DataEnv", sql.DateTime, new Date(dataEnv)); // você pode enviar a data como ISO

    await request.execute("SpGrRecoEnv");

    res.status(200).json({
      message: "Recomendação enviada com sucesso!"
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao enviar recomendação",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});


//////////////////////////************* FIM - API ZIMU *****************/////////////////////////////////

// Configuração final
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});