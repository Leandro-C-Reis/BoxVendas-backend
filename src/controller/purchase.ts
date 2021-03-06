import { Request, Response } from 'express';
import database from '../database/connection';
import frete from './correiosController';

class PurchaseController 
{
    async index(request : Request, response : Response)
    {
        const data = await database('purchases').select('*');

        return response.status(200).json(data);
    }

    async show(request : Request, response : Response)
    {
        const { id } = request.params;
        if (!id) return response.status(406).json({
            code: 406,
            message: "id is missing"
        });

        const data = await database('purchases').select('*').where({ id });

        if (data.length == 0) return response.status(404).json({
            code: 404,
            message: "purchase not founded"
        });

        return response.status(200).json(data);
    }

    async show_of_user(request : Request, response : Response)
    {
        const { id } = request.params // user id
        if (!id) return response.status(406).json({
            code: 406,
            message: "user id is missing"
        });
        
        const data = await database('purchases').select('*').where('user_id', id);
        if (data.length == 0) return response.status(404).json({
            code: 404,
            message: "User does not exist or does not haves a purchase"
        });

        return response.status(200).json(data);
    }

    async show_inprocess(request : Request, response : Response)
    {
        const data = await database('purchases').select('*').where('status', 'inprocess');

        response.status(200).json(data);
    }

    async show_completed(request : Request, response : Response)
    {
        const data = await database('purchases').select('*').where('status', 'completed');

        return response.status(200).json(data);
    }

    async create(request : Request, response : Response)
    {
        const { user_id, product_id, address_id, payment_status , servico} = request.body; 
        
        if (!user_id || !product_id || !address_id || !payment_status) return response.status(406).json({
            error: 406,
            message: 'Credentials is missing'
        });
        const now = new Date;
        const register_date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`; 
        const trx = await database.transaction();
        
        const userExist = (await trx('users').select('id').where({ id: user_id })).length;
        const productExist = (await trx('products').select('id').where({ id: product_id })).length;
        const addressExist = (await trx('address').select('id').where({ id: address_id})).length;
        
        if (!userExist || !productExist || !addressExist) return response.status(406).json({
            error: 406,
            message: 'User or product or address does not exist'
        });

        const isAddress = await trx('user_address').select('user_id').where('address_id', address_id);

        if (isAddress.length == 0) return response.status(406).json({
            code: 406,
            message: "This address does not correspond to the user"
        });
        
        
        const product = (await trx('products').select('*').where('id', product_id))[0];
        const salesman_address = (await trx('address').select('*').where('id', product.address_id))[0];
        const user_address = (await trx('address').select('*').where('id', address_id))[0];
        
        const nfreight : any = await frete({
            'nCdServico': servico, // 04510
            'sCepOrigem': salesman_address.cep,
            'sCepDestino': user_address.cep,
            'nVlPeso': product.peso, // 1 em Kg
            'nCdFormato': product.formato, // 1
            'nVlComprimento': product.comprimento, // 20 em Cm
            'nVlAltura': product.altura, // 2
            'nVlLargura': product.largura, // 20
            'nVlDiametro': product.diametro, // 0
            'sCdMaoPropria': 'n',
            'nVlValorDeclarado': 0,
            'sCdAvisoRecebimento': 'n'
        });
        
        const freight = parseFloat(nfreight.Servicos.cServico.Valor.replace(',', '.'))
        const uniq_value = (await trx('products').select('value').where({ id: product_id }))[0].value;
        const total_value :number = freight + uniq_value;
        
        const data = {
            user_id,
            product_id,
            address_id,
            payment_status,
            send: false,
            receivment: false,
            tracking_code: null,
            freight_value: freight,
            uniq_value,
            total_value,
            integration_id: null,
            register_date,
            servico,
            status: 'payment in process'
        }

        const created = await trx('purchases').insert(data);

        if (!created || created.length == 0) 
        {
            await trx.rollback();
            return response.status(406).json({
                code: "406",
                message: "Not created"
            });
        }

        await trx.commit();
        
        return response.status(200).json(data);
    }

    async update(request : Request, response : Response)
    {
        const { id } = request.params; // purchase id
        if (!id) return response.status(406).json({
            code: 406,
            message: "id is missing"
        });

        const trx = await database.transaction();
        const oldData = await trx('purchases').select('*').where({ id });
        if (oldData.length == 0) return response.status(406).json({
            code: 406,
            message: "Purchase does not exist whit this ID"
        });

        const { payment_status = oldData[0].payment_status,
            send = oldData[0].send,
            receivment = oldData[0].receivment,
            tracking_code = oldData[0].tracking_code
        } = request.body;
        
        let status;
        
        switch(payment_status)
        {
            case 'payed':
                status = 'sending';
                break;
            case 'expired':
                status = 'completed';
                break;
        }
        
        const data = { payment_status, send, receivment, tracking_code };
        const updated = await trx('purchases').where({ id }).update(data);
        if (!updated)
        {
            await trx.rollback();
            return response.status(406).json({
                code: 406,
                message: "Not updated"
            });
        }

        await trx.commit();
        return response.status(200).json();
    }
}

export default PurchaseController;
