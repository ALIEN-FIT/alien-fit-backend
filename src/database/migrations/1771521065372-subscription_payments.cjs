'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("subscription_payments")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"subscription_payments\" (\"id\" UUID , \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"packageId\" UUID NOT NULL, \"planType\" VARCHAR(20) NOT NULL DEFAULT 'both', \"provider\" VARCHAR(50) NOT NULL DEFAULT 'fawaterak', \"status\" VARCHAR(20) NOT NULL DEFAULT 'pending', \"currency\" VARCHAR(10) NOT NULL, \"amount\" DECIMAL(12,2) NOT NULL, \"invoiceId\" INTEGER, \"invoiceKey\" VARCHAR(255), \"paymentUrl\" TEXT, \"webhookPayload\" JSON, \"paidAt\" TIMESTAMP WITH TIME ZONE, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"subscription_payments_user_id\" ON \"subscription_payments\" (\"userId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"subscription_payments_package_id\" ON \"subscription_payments\" (\"packageId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"subscription_payments_plan_type\" ON \"subscription_payments\" (\"planType\")");
    await queryInterface.sequelize.query("CREATE INDEX \"subscription_payments_status\" ON \"subscription_payments\" (\"status\")");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"subscription_payments_invoice_id\" ON \"subscription_payments\" (\"invoiceId\")");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"subscription_payments_invoice_key\" ON \"subscription_payments\" (\"invoiceKey\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("subscription_payments");
  },
};
