import Knex from 'knex';

export async function up(knex: Knex) {
    return knex.schema.createTable('products', table => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.text('description').notNullable();
        table.date('register_date').notNullable();
        table.float('value').notNullable();
        table.integer('stock').notNullable();

        table.integer('address_id').unsigned().notNullable();
        table.foreign('address_id').references('id').inTable('address');
        table.integer('salesman_id').unsigned().notNullable();
        table.foreign('salesman_id').references('id').inTable('salespeople');
        
        table.integer('formato').notNullable().unsigned();
        table.string('peso').notNullable();
        table.float('comprimento').notNullable().unsigned();
        table.float('altura').notNullable().unsigned();
        table.float('largura').notNullable().unsigned();
        table.float('diametro').notNullable().unsigned();
    });
}

export async function down(knex: Knex) {
    return knex.schema.dropTable('products');
}